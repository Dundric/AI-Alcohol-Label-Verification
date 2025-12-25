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
      const text = await file.text();
      const { map, error } = parseExpectedCsv(text);

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
      setCsvError("Failed to parse CSV file.");
    }
  };

  return {
    csvExpectedMap,
    csvError,
    handleCsvChange,
  };
}
