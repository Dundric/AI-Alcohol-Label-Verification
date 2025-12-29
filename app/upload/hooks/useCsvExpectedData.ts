import { useState, type ChangeEvent } from "react";
import {
  CsvExpectedMap,
  parseExpectedCsv,
} from "@/lib/upload/expectedCsv";

export function useCsvExpectedData(): {
  csvExpectedMap: CsvExpectedMap | null;
  csvError: string | null;
  handleCsvChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
} {
  const [csvExpectedMap, setCsvExpectedMap] = useState<CsvExpectedMap | null>(
    null
  );
  const [csvError, setCsvError] = useState<string | null>(null);

  const handleCsvChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0]) {
      setCsvExpectedMap(null);
      setCsvError(null);
      return;
    }

    const file = event.target.files[0];
    try {
      const lowerName = file.name.toLowerCase();
      const isCsv =
        lowerName.endsWith(".csv") ||
        file.type === "text/csv" ||
        file.type === "application/vnd.ms-excel";
      const isExcel =
        lowerName.endsWith(".xlsx") ||
        lowerName.endsWith(".xls") ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      let map: CsvExpectedMap | null = null;
      let error: string | null = null;

      if (isExcel) {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          setCsvExpectedMap(null);
          setCsvError("Excel file must include at least one sheet.");
          return;
        }
        const worksheet = workbook.Sheets[sheetName];
        const csvText = XLSX.utils.sheet_to_csv(worksheet);
        ({ map, error } = parseExpectedCsv(csvText));
      } else if (isCsv) {
        const text = await file.text();
        ({ map, error } = parseExpectedCsv(text));
      } else {
        setCsvExpectedMap(null);
        setCsvError("Unsupported file type. Upload a CSV or Excel file.");
        return;
      }

      if (error) {
        setCsvExpectedMap(null);
        setCsvError(error);
        return;
      }

      setCsvExpectedMap(map);
      setCsvError(null);
    } catch (error) {
      console.error("Failed to parse CSV:", error);
      setCsvExpectedMap(null);
      setCsvError("Failed to parse CSV or Excel file.");
    }
  };

  return {
    csvExpectedMap,
    csvError,
    handleCsvChange,
  };
}
