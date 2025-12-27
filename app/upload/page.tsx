"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { batchExtractLabelData, extractLabelData } from "@/lib/ocr";
import type { ExpectedAlcoholLabel, LabelVerification } from "@/lib/schemas";
import { calculateOverallStatus, compareLabels } from "@/lib/compare";
import { CSV_PARALLEL_LIMIT } from "@/lib/upload/constants";
import {
  getExpectedDataValidationError,
  normalizeExpectedData,
} from "@/lib/upload/expectedData";
import type { CsvExpectedMap } from "@/lib/upload/expectedCsv";
import { CsvUploadCard } from "./components/CsvUploadCard";
import { ExpectedDataForm } from "./components/ExpectedDataForm";
import { ImageUploadCard } from "./components/ImageUploadCard";
import { ModeSelector, type UploadMode } from "./components/ModeSelector";
import { ProgressBar } from "./components/ProgressBar";
import { useCsvExpectedData } from "./hooks/useCsvExpectedData";
import { useExpectedLabelForm } from "./hooks/useExpectedLabelForm";
import { useImageSelection } from "./hooks/useImageSelection";

type ExtractionResult = Awaited<ReturnType<typeof extractLabelData>>;

type CsvMatchResult = {
  missing: string[];
  hasMissing: boolean;
};

function getMissingCsvMatches(
  files: File[],
  csvExpectedMap: CsvExpectedMap
): CsvMatchResult {
  const missing = files.filter((file) => !csvExpectedMap[file.name]);
  return {
    missing: missing.map((file) => file.name),
    hasMissing: missing.length > 0,
  };
}

function buildVerification(
  imageId: string,
  imageName: string,
  extractedResult: ExtractionResult,
  expected: ExpectedAlcoholLabel
): LabelVerification {
  const results = compareLabels(
    extractedResult.label,
    expected,
    extractedResult.evaluation
  );
  const overallStatus = calculateOverallStatus(results);

  return {
    imageId,
    imageName,
    extractedData: extractedResult.label,
    expectedData: expected,
    evaluation: extractedResult.evaluation,
    results,
    overallStatus,
  };
}

export default function UploadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<UploadMode>("single");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const { files, fileError, handleFileChange, handleFolderChange } =
    useImageSelection();
  const { expectedData, handlers: expectedHandlers } = useExpectedLabelForm();
  const { csvExpectedMap, csvError, handleCsvChange } = useCsvExpectedData();

  const processCsvBatch = async (
    runId: number,
    expectedMap: CsvExpectedMap
  ): Promise<LabelVerification[]> => {
    const total = files.length;
    let completed = 0;
    const verifications: LabelVerification[] = [];

    for (let i = 0; i < files.length; i += CSV_PARALLEL_LIMIT) {
      const batch = files.slice(i, i + CSV_PARALLEL_LIMIT);
      const batchResults = await Promise.all(
        batch.map(async (file, index) => {
          const expected = expectedMap[file.name];
          const extractedResult = await extractLabelData(
            file,
            file.name,
            expected
          );

          completed += 1;
          setProgress(Math.round((completed / total) * 100));

          return buildVerification(
            `img-${runId}-${i + index}`,
            file.name,
            extractedResult,
            expected
          );
        })
      );

      verifications.push(...batchResults);
    }

    return verifications;
  };

  const processSingle = async (
    runId: number,
    file: File,
    expected: ExpectedAlcoholLabel
  ): Promise<LabelVerification[]> => {
    const extractedResult = await extractLabelData(file, file.name, expected);
    setProgress(100);

    return [buildVerification(`img-${runId}`, file.name, extractedResult, expected)];
  };

  const processBatch = async (
    runId: number,
    expected: ExpectedAlcoholLabel
  ): Promise<LabelVerification[]> => {
    const total = files.length;
    const extractedResults = await batchExtractLabelData(files, expected);
    const verifications: LabelVerification[] = [];

    for (let i = 0; i < extractedResults.length; i++) {
      const { name, data: extractedResult } = extractedResults[i];
      verifications.push(
        buildVerification(`img-${runId}-${i}`, name, extractedResult, expected)
      );
      setProgress(Math.round(((i + 1) / total) * 100));
    }

    return verifications;
  };

  const processImages = async () => {
    if (files.length === 0) {
      alert("Please select at least one image");
      return;
    }

    if (csvExpectedMap) {
      const { missing, hasMissing } = getMissingCsvMatches(
        files,
        csvExpectedMap
      );
      if (hasMissing) {
        alert(`CSV missing expected data for: ${missing.join(", ")}`);
        return;
      }
    }

    const normalizedExpectedData = normalizeExpectedData(expectedData);
    if (!csvExpectedMap) {
      const validationError = getExpectedDataValidationError(
        normalizedExpectedData
      );
      if (validationError) {
        alert(`Please check the expected fields:\n- ${validationError}`);
        return;
      }
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const runId = Date.now();
      let verifications: LabelVerification[] = [];

      if (csvExpectedMap) {
        verifications = await processCsvBatch(runId, csvExpectedMap);
      } else if (mode === "single") {
        verifications = await processSingle(
          runId,
          files[0],
          normalizedExpectedData
        );
      } else {
        verifications = await processBatch(runId, normalizedExpectedData);
      }

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

      <ModeSelector mode={mode} onChange={setMode} />

      <ImageUploadCard
        mode={mode}
        files={files}
        fileError={fileError}
        onFileChange={handleFileChange}
        onFolderChange={handleFolderChange}
      />

      {mode === "batch" && (

      <CsvUploadCard
        csvError={csvError}
        csvExpectedMap={csvExpectedMap}
        onChange={handleCsvChange}
      />     
      )}
      {mode === "single" && (
        <ExpectedDataForm expectedData={expectedData} handlers={expectedHandlers} />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <button
          onClick={processImages}
          disabled={isProcessing || files.length === 0}
          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Process uploaded images"
        >
          {isProcessing ? "Processing..." : "Process & Verify Labels"}
        </button>

        {isProcessing && <ProgressBar progress={progress} />}
      </div>
    </div>
  );
}
