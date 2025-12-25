import { expectedAlcoholLabelSchema, ExpectedAlcoholLabel } from "@/lib/schemas";
import {
  buildGovernmentWarningField,
  buildSimpleField,
} from "@/lib/upload/expectedData";
import {
  REQUIRED_CSV_COLUMNS,
  STANDARD_GOV_WARNING_LONG,
} from "@/lib/upload/constants";

export type CsvExpectedMap = Record<string, ExpectedAlcoholLabel>;

type ParseExpectedCsvResult = {
  map: CsvExpectedMap | null;
  error: string | null;
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((value) => value.trim());
}

function parseCsv(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  return lines.map(parseCsvLine);
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ["true", "yes", "1", "y"].includes(normalized);
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function buildExpectedFromRow(
  row: Record<string, string>
): { imageName: string; expected: ExpectedAlcoholLabel } | null {
  const imageName = row.image_name?.trim();
  if (!imageName) return null;

  const rawProductType = row.product_type?.trim().toLowerCase();
  const normalizedProductType =
    rawProductType &&
    ["beer", "wine", "whiskey", "rum", "other_spirits"].includes(rawProductType)
      ? (rawProductType as ExpectedAlcoholLabel["productType"])
      : null;

  return {
    imageName,
    expected: {
      productType: normalizedProductType,
      brandName: buildSimpleField(row.brand_name ?? ""),
      classType: buildSimpleField(row.class_type ?? ""),
      alcoholContent: row.alcohol_content?.trim()
        ? buildSimpleField(row.alcohol_content)
        : null,
      netContents: buildSimpleField(row.net_contents ?? ""),
      governmentWarning: buildGovernmentWarningField(
        row.government_warning?.trim() || STANDARD_GOV_WARNING_LONG
      ),
      bottlerProducer: buildSimpleField(row.bottler_producer ?? ""),
      countryOfOrigin: row.country_of_origin
        ? buildSimpleField(row.country_of_origin)
        : null,
      ageYears: parseNumber(row.age_years),
      isImported: parseBoolean(row.is_imported),
      beerHasAddedFlavorsWithAlcohol: parseBoolean(
        row.beer_has_added_flavors_with_alcohol
      ),
      additivesDetected: {
        fdcYellowNo5: parseBoolean(row.additive_fdc_yellow_no_5),
        cochinealExtract: parseBoolean(row.additive_cochineal_extract),
        carmine: parseBoolean(row.additive_carmine),
        aspartame: parseBoolean(row.additive_aspartame),
        sulfitesGe10ppm: parseBoolean(row.additive_sulfites_ge_10ppm),
      },
    },
  };
}

export function parseExpectedCsv(text: string): ParseExpectedCsvResult {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return {
      map: null,
      error: "CSV must include a header row and at least one data row.",
    };
  }

  const headers = rows[0].map(normalizeHeader);
  const missingHeaders = REQUIRED_CSV_COLUMNS.filter(
    (column) => !headers.includes(column)
  );

  if (missingHeaders.length > 0) {
    return {
      map: null,
      error: `CSV missing required columns: ${missingHeaders.join(", ")}`,
    };
  }

  const map: CsvExpectedMap = {};
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowData: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowData[header] = row[index] ?? "";
    });

    const built = buildExpectedFromRow(rowData);
    if (!built) {
      errors.push(`Row ${i + 1}: missing image_name`);
      continue;
    }

    const parsed = expectedAlcoholLabelSchema.safeParse(built.expected);
    if (!parsed.success) {
      errors.push(
        `Row ${i + 1}: ${parsed.error.issues
          .map((issue) => issue.message)
          .join(", ")}`
      );
      continue;
    }

    map[built.imageName] = parsed.data;
  }

  if (errors.length > 0) {
    return {
      map: null,
      error: errors.slice(0, 5).join("\n"),
    };
  }

  return { map, error: null };
}
