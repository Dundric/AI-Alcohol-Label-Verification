"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ZodError } from "zod";
import { extractLabelData, batchExtractLabelData } from "@/lib/ocr";
import {
  AdditiveDisclosure,
  expectedAlcoholLabelSchema,
  ExpectedAlcoholLabel,
  GovernmentWarningField,
  SimpleField,
  LabelVerification,
} from "@/lib/schemas";
import { compareLabels, calculateOverallStatus } from "@/lib/compare";

type RequiredFieldKey = "brandName" | "classType" | "netContents" | "bottlerProducer";
type OptionalFieldKey =
  | "countryOfOrigin";
type FlagFieldKey = "isImported" | "beerHasAddedFlavorsWithAlcohol";
type CsvExpectedMap = Record<string, ExpectedAlcoholLabel>;

const REQUIRED_CSV_COLUMNS = [
  "image_name",
  "brand_name",
  "class_type",
  "alcohol_content",
  "net_contents",
  "bottler_producer",
];
const CSV_PARALLEL_LIMIT = 5;
const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
];
const STANDARD_GOV_WARNING_LONG =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

const defaultAdditives: AdditiveDisclosure = {
  fdcYellowNo5: false,
  cochinealExtract: false,
  carmine: false,
  aspartame: false,
  sulfitesGe10ppm: false,
};

function buildSimpleField(text: string): SimpleField {
  return { text };
}

function buildGovernmentWarningField(text: string): GovernmentWarningField {
  return {
    text,
    isBold: true,
    isAllCaps: true,
  };
}

function filterImageFiles(fileList: FileList): File[] {
  return Array.from(fileList).filter((file) => {
    if (file.type.startsWith("image/")) return true;
    const lowerName = file.name.toLowerCase();
    return IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  });
}

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
    rawProductType && ["beer", "wine", "whiskey", "rum", "other_spirits"].includes(rawProductType)
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

export default function UploadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [files, setFiles] = useState<File[]>([]);
  const [csvExpectedMap, setCsvExpectedMap] = useState<CsvExpectedMap | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expectedData, setExpectedData] = useState<ExpectedAlcoholLabel>({
    productType: null,
    brandName: buildSimpleField("Jack Daniel's"),
    classType: buildSimpleField("Tennessee Whiskey"),
    alcoholContent: buildSimpleField("40%"),
    netContents: buildSimpleField("750ml"),
    governmentWarning: buildGovernmentWarningField(
      STANDARD_GOV_WARNING_LONG
    ),
    bottlerProducer: buildSimpleField("Jack Daniel's Distillery"),
    countryOfOrigin: null,
    ageYears: null,
    isImported: false,
    beerHasAddedFlavorsWithAlcohol: false,
    additivesDetected: defaultAdditives,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileArray = filterImageFiles(e.target.files);
      setFiles(fileArray);
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileArray = filterImageFiles(e.target.files);
      setFiles(fileArray);
    }
  };

  const handleCsvChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) {
      setCsvExpectedMap(null);
      setCsvError(null);
      return;
    }

    const file = e.target.files[0];
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) {
        setCsvExpectedMap(null);
        setCsvError("CSV must include a header row and at least one data row.");
        return;
      }

      const headers = rows[0].map(normalizeHeader);
      const missingHeaders = REQUIRED_CSV_COLUMNS.filter(
        (column) => !headers.includes(column)
      );

      if (missingHeaders.length > 0) {
        setCsvExpectedMap(null);
        setCsvError(
          `CSV missing required columns: ${missingHeaders.join(", ")}`
        );
        return;
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
        setCsvExpectedMap(null);
        setCsvError(errors.slice(0, 5).join("\n"));
        return;
      }

      setCsvExpectedMap(map);
      setCsvError(null);
    } catch (error) {
      console.error("Failed to parse CSV:", error);
      setCsvExpectedMap(null);
      setCsvError("Failed to parse CSV file.");
    }
  };

  const handleRequiredDataChange = (field: RequiredFieldKey, value: string) => {
    setExpectedData((prev) => ({
      ...prev,
      [field]: { ...prev[field], text: value },
    }));
  };

  const handleAlcoholContentChange = (value: string) => {
    const trimmed = value.trim();
    setExpectedData((prev) => ({
      ...prev,
      alcoholContent: trimmed.length === 0 ? null : buildSimpleField(value),
    }));
  };

  const handleGovernmentWarningChange = (value: string) => {
    setExpectedData((prev) => ({
      ...prev,
      governmentWarning: { ...prev.governmentWarning, text: value },
    }));
  };

  const handleOptionalDataChange = (field: OptionalFieldKey, value: string) => {
    const trimmed = value.trim();
    setExpectedData((prev) => ({
      ...prev,
      [field]: trimmed.length === 0 ? null : buildSimpleField(value),
    }));
  };

  const handleFlagChange = (field: FlagFieldKey, value: boolean) => {
    setExpectedData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAgeYearsChange = (value: string) => {
    const parsed = Number.parseFloat(value);
    setExpectedData((prev) => ({
      ...prev,
      ageYears: Number.isNaN(parsed) ? null : parsed,
    }));
  };

  const handleAdditiveToggle = (
    key: keyof AdditiveDisclosure,
    value: boolean
  ) => {
    setExpectedData((prev) => ({
      ...prev,
      additivesDetected: { ...prev.additivesDetected, [key]: value },
    }));
  };

  const processImages = async () => {
    if (files.length === 0) {
      alert("Please select at least one image");
      return;
    }

    if (csvExpectedMap) {
      const missingMatches = files.filter(
        (file) => !csvExpectedMap[file.name]
      );
      if (missingMatches.length > 0) {
        alert(
          `CSV missing expected data for: ${missingMatches
            .map((file) => file.name)
            .join(", ")}`
        );
        return;
      }
    }

    const normalizedExpectedData: ExpectedAlcoholLabel = {
      ...expectedData,
      governmentWarning: {
        ...expectedData.governmentWarning,
        isBold: true,
        isAllCaps: true,
      },
    };

    if (!csvExpectedMap) {
      try {
        // Validate expected data
        expectedAlcoholLabelSchema.parse(normalizedExpectedData);
      } catch (error) {
        if (error instanceof ZodError) {
          console.error("Expected data validation failed:", error.issues);
          alert(
            `Please check the expected fields:\n- ${error.issues
              .map((issue) => issue.message)
              .join("\n- ")}`
          );
        } else {
          alert("Please fill in all expected data fields correctly");
        }
        return;
      }
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      let verifications: LabelVerification[] = [];

      if (csvExpectedMap) {
        const total = files.length;
        let completed = 0;

        for (let i = 0; i < files.length; i += CSV_PARALLEL_LIMIT) {
          const batch = files.slice(i, i + CSV_PARALLEL_LIMIT);
          const batchResults = await Promise.all(
            batch.map(async (file, index) => {
              const expected = csvExpectedMap[file.name];
              const extractedResult = await extractLabelData(
                file,
                file.name,
                expected
              );
          const results = compareLabels(
            extractedResult.label,
            expected,
            extractedResult.evaluation
          );
              const overallStatus = calculateOverallStatus(results);

              completed += 1;
              setProgress(Math.round((completed / total) * 100));

              return {
                imageId: `img-${Date.now()}-${i + index}`,
                imageName: file.name,
                extractedData: extractedResult.label,
                expectedData: expected,
                evaluation: extractedResult.evaluation,
                results,
                overallStatus,
              };
            })
          );

          verifications.push(...batchResults);
        }
      } else if (mode === "single") {
        const file = files[0];
        const extractedResult = await extractLabelData(
          file,
          file.name,
          normalizedExpectedData
        );
        const results = compareLabels(
          extractedResult.label,
          normalizedExpectedData,
          extractedResult.evaluation
        );
        const overallStatus = calculateOverallStatus(results);

        verifications = [
          {
            imageId: `img-${Date.now()}`,
            imageName: file.name,
            extractedData: extractedResult.label,
            expectedData: normalizedExpectedData,
            evaluation: extractedResult.evaluation,
            results,
            overallStatus,
          },
        ];
        setProgress(100);
      } else {
        // Batch processing with progress updates
        const total = files.length;
        const extractedResults = await batchExtractLabelData(
          files,
          normalizedExpectedData
        );

        for (let i = 0; i < extractedResults.length; i++) {
          const { name, data: extractedResult } = extractedResults[i];
          const results = compareLabels(
            extractedResult.label,
            normalizedExpectedData,
            extractedResult.evaluation
          );
          const overallStatus = calculateOverallStatus(results);

          verifications.push({
            imageId: `img-${Date.now()}-${i}`,
            imageName: name,
            extractedData: extractedResult.label,
            expectedData: normalizedExpectedData,
            evaluation: extractedResult.evaluation,
            results,
            overallStatus,
          });

          setProgress(Math.round(((i + 1) / total) * 100));
        }
      }

      // Store results in sessionStorage and navigate to review
      sessionStorage.setItem("verifications", JSON.stringify(verifications));
      router.push("/review");
    } catch (error) {
      console.error("Error processing images:", error);
      alert("Error processing images. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-6 text-center">Upload Labels</h1>

      {/* Mode Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload Mode</h2>
        <div className="flex gap-4" role="radiogroup" aria-label="Upload mode selection">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="single"
              checked={mode === "single"}
              onChange={(e) => setMode(e.target.value as "single" | "batch")}
              className="w-4 h-4"
              aria-label="Single image upload mode"
            />
            <span>Single Image</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="batch"
              checked={mode === "batch"}
              onChange={(e) => setMode(e.target.value as "single" | "batch")}
              className="w-4 h-4"
              aria-label="Batch image upload mode"
            />
            <span>Batch Upload</span>
          </label>
        </div>
      </div>

      {/* File Upload */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Select Images</h2>
        <div className="mb-4">
          <label
            htmlFor="file-upload"
            className="block w-full px-4 py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center cursor-pointer hover:border-blue-500 transition-colors"
          >
            <span className="text-4xl mb-2 block">📁</span>
            <span className="text-gray-600 dark:text-gray-400">
              Click to select {mode === "single" ? "an image" : "images"}
            </span>
            <input
              id="file-upload"
              type="file"
              accept="image/*"
              multiple={mode === "batch"}
              onChange={handleFileChange}
              className="hidden"
              aria-label={`Upload ${mode === "single" ? "single" : "multiple"} image(s)`}
            />
          </label>
        </div>
        {mode === "batch" && (
          <div className="mb-4">
            <label
              htmlFor="folder-upload"
              className="block w-full px-4 py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center cursor-pointer hover:border-blue-500 transition-colors"
            >
              <span className="text-3xl mb-2 block">🗂️</span>
              <span className="text-gray-600 dark:text-gray-400">
                Or select a folder of images (Chromium browsers)
              </span>
              <input
                id="folder-upload"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFolderChange}
                className="hidden"
                // @ts-expect-error webkitdirectory is supported in Chromium
                webkitdirectory="true"
              />
            </label>
          </div>
        )}
        {files.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Selected Files:</h3>
            <ul className="list-disc list-inside space-y-1">
              {files.map((file, index) => (
                <li key={index} className="text-sm text-gray-600 dark:text-gray-400">
                  {(file as File & { webkitRelativePath?: string })
                    .webkitRelativePath || file.name}{" "}
                  ({(file.size / 1024).toFixed(2)} KB)
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* CSV Upload */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Expected Data CSV (Optional)</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Upload a CSV with expected label data and the image filename to match.
          Required columns: image_name, brand_name, class_type, alcohol_content,
          net_contents, bottler_producer.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          When a CSV is loaded, the manual expected fields below are ignored.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleCsvChange}
          className="block w-full text-sm text-gray-600 dark:text-gray-300"
          aria-label="Upload expected data CSV"
        />
        {csvError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400 whitespace-pre-line">
            {csvError}
          </p>
        )}
        {csvExpectedMap && (
          <p className="mt-3 text-sm text-green-700 dark:text-green-300">
            Loaded {Object.keys(csvExpectedMap).length} CSV rows.
          </p>
        )}
      </div>

      {/* Expected Data Form */}
      {mode === "single" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Expected Label Data</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Enter the expected values to compare against the extracted data.
          </p>
          <div className="space-y-4">
            <div>
              <label htmlFor="brand" className="block font-semibold mb-1">
                Brand Name
              </label>
              <input
                id="brand"
                type="text"
                value={expectedData.brandName.text}
                onChange={(e) => handleRequiredDataChange("brandName", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Expected brand name"
              />
            </div>
            <div>
              <label htmlFor="classType" className="block font-semibold mb-1">
                Class/Type
              </label>
              <input
                id="classType"
                type="text"
                value={expectedData.classType.text}
                onChange={(e) => handleRequiredDataChange("classType", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Expected class or type"
              />
            </div>
            <div>
              <label htmlFor="alcoholContent" className="block font-semibold mb-1">
                Alcohol Content (Optional for beer/malt liquor)
              </label>
              <input
                id="alcoholContent"
                type="text"
                value={expectedData.alcoholContent?.text ?? ""}
                onChange={(e) => handleAlcoholContentChange(e.target.value)}
                placeholder="e.g., 40%"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Expected alcohol content"
              />
            </div>
            <div>
              <label htmlFor="netContents" className="block font-semibold mb-1">
                Net Contents
              </label>
              <input
                id="netContents"
                type="text"
                value={expectedData.netContents.text}
                onChange={(e) => handleRequiredDataChange("netContents", e.target.value)}
                placeholder="e.g., 750ml"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Expected net contents"
              />
            </div>
            <div>
              <label htmlFor="bottlerProducer" className="block font-semibold mb-1">
                Bottler/Producer
              </label>
              <input
                id="bottlerProducer"
                type="text"
                value={expectedData.bottlerProducer.text}
                onChange={(e) =>
                  handleRequiredDataChange("bottlerProducer", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Expected bottler or producer"
              />
            </div>
            <div>
              <label htmlFor="countryOfOrigin" className="block font-semibold mb-1">
                Country of Origin (Optional)
              </label>
              <input
                id="countryOfOrigin"
                type="text"
                value={expectedData.countryOfOrigin?.text ?? ""}
                onChange={(e) =>
                  handleOptionalDataChange("countryOfOrigin", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Expected country of origin"
              />
            </div>
            <div>
              <label htmlFor="ageYears" className="block font-semibold mb-1">
                Age (Years) (Optional)
              </label>
              <input
                id="ageYears"
                type="number"
                min="0"
                step="0.1"
                value={expectedData.ageYears ?? ""}
                onChange={(e) => handleAgeYearsChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Expected age in years"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="isImported"
                type="checkbox"
                checked={expectedData.isImported}
                onChange={(e) => handleFlagChange("isImported", e.target.checked)}
                className="w-4 h-4"
                aria-label="Product is imported"
              />
              <label htmlFor="isImported" className="font-semibold">
                Imported Product
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="beerHasAddedFlavorsWithAlcohol"
                type="checkbox"
                checked={expectedData.beerHasAddedFlavorsWithAlcohol}
                onChange={(e) =>
                  handleFlagChange("beerHasAddedFlavorsWithAlcohol", e.target.checked)
                }
                className="w-4 h-4"
                aria-label="Beer has alcohol from added flavors"
              />
              <label
                htmlFor="beerHasAddedFlavorsWithAlcohol"
                className="font-semibold"
              >
                Beer contains alcohol from added flavors
              </label>
            </div>
            <div>
              <span className="block font-semibold mb-2">Additives Detected</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={expectedData.additivesDetected.fdcYellowNo5}
                    onChange={(e) =>
                      handleAdditiveToggle("fdcYellowNo5", e.target.checked)
                    }
                    className="w-4 h-4"
                  />
                  <span>FD&amp;C Yellow No. 5</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={expectedData.additivesDetected.cochinealExtract}
                    onChange={(e) =>
                      handleAdditiveToggle("cochinealExtract", e.target.checked)
                    }
                    className="w-4 h-4"
                  />
                  <span>cochineal extract</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={expectedData.additivesDetected.carmine}
                    onChange={(e) =>
                      handleAdditiveToggle("carmine", e.target.checked)
                    }
                    className="w-4 h-4"
                  />
                  <span>carmine</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={expectedData.additivesDetected.aspartame}
                    onChange={(e) =>
                      handleAdditiveToggle("aspartame", e.target.checked)
                    }
                    className="w-4 h-4"
                  />
                  <span>aspartame</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={expectedData.additivesDetected.sulfitesGe10ppm}
                    onChange={(e) =>
                      handleAdditiveToggle("sulfitesGe10ppm", e.target.checked)
                    }
                    className="w-4 h-4"
                  />
                  <span>sulfites &gt;= 10PPM</span>
                </label>
              </div>
            </div>
            <div>
              <label htmlFor="governmentWarning" className="block font-semibold mb-1">
                Government Warning
              </label>
              <textarea
                id="governmentWarning"
                value={expectedData.governmentWarning.text}
                onChange={(e) => handleGovernmentWarningChange(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Expected government warning text"
              />
            </div>
          </div>
        </div>
      )}

      {/* Process Button */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <button
          onClick={processImages}
          disabled={isProcessing || files.length === 0}
          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Process uploaded images"
        >
          {isProcessing ? "Processing..." : "Process & Verify Labels"}
        </button>

        {isProcessing && (
          <div className="mt-4" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Processing...</span>
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
