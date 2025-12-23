"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { extractLabelData, batchExtractLabelData } from "@/lib/ocr";
import { alcoholLabelSchema, AlcoholLabel, LabelVerification } from "@/lib/schemas";
import { compareLabels, calculateOverallStatus } from "@/lib/compare";

export default function UploadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expectedData, setExpectedData] = useState<AlcoholLabel>({
    brand: "Jack Daniel's",
    classType: "Tennessee Whiskey",
    abv: "40%",
    netContents: "750ml",
    govWarning:
      "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileArray = Array.from(e.target.files);
      setFiles(fileArray);
    }
  };

  const handleExpectedDataChange = (field: keyof AlcoholLabel, value: string) => {
    setExpectedData((prev) => ({ ...prev, [field]: value }));
  };

  const processImages = async () => {
    if (files.length === 0) {
      alert("Please select at least one image");
      return;
    }

    try {
      // Validate expected data
      alcoholLabelSchema.parse(expectedData);
    } catch (error) {
      alert("Please fill in all expected data fields correctly");
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      let verifications: LabelVerification[] = [];

      if (mode === "single") {
        const file = files[0];
        const extractedData = await extractLabelData(file, file.name);
        const results = compareLabels(extractedData, expectedData);
        const overallStatus = calculateOverallStatus(results);

        verifications = [
          {
            imageId: `img-${Date.now()}`,
            imageName: file.name,
            extractedData,
            expectedData,
            results,
            overallStatus,
          },
        ];
        setProgress(100);
      } else {
        // Batch processing with progress updates
        const total = files.length;
        const extractedResults = await batchExtractLabelData(files);

        for (let i = 0; i < extractedResults.length; i++) {
          const { name, data: extractedData } = extractedResults[i];
          const results = compareLabels(extractedData, expectedData);
          const overallStatus = calculateOverallStatus(results);

          verifications.push({
            imageId: `img-${Date.now()}-${i}`,
            imageName: name,
            extractedData,
            expectedData,
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
        {files.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Selected Files:</h3>
            <ul className="list-disc list-inside space-y-1">
              {files.map((file, index) => (
                <li key={index} className="text-sm text-gray-600 dark:text-gray-400">
                  {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Expected Data Form */}
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
              value={expectedData.brand}
              onChange={(e) => handleExpectedDataChange("brand", e.target.value)}
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
              value={expectedData.classType}
              onChange={(e) => handleExpectedDataChange("classType", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Expected class or type"
            />
          </div>
          <div>
            <label htmlFor="abv" className="block font-semibold mb-1">
              ABV (Alcohol by Volume)
            </label>
            <input
              id="abv"
              type="text"
              value={expectedData.abv}
              onChange={(e) => handleExpectedDataChange("abv", e.target.value)}
              placeholder="e.g., 40%"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Expected ABV percentage"
            />
          </div>
          <div>
            <label htmlFor="netContents" className="block font-semibold mb-1">
              Net Contents
            </label>
            <input
              id="netContents"
              type="text"
              value={expectedData.netContents}
              onChange={(e) => handleExpectedDataChange("netContents", e.target.value)}
              placeholder="e.g., 750ml"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Expected net contents"
            />
          </div>
          <div>
            <label htmlFor="govWarning" className="block font-semibold mb-1">
              Government Warning
            </label>
            <textarea
              id="govWarning"
              value={expectedData.govWarning}
              onChange={(e) => handleExpectedDataChange("govWarning", e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Expected government warning text"
            />
          </div>
        </div>
      </div>

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
