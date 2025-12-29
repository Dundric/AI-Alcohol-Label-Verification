"use client";

import { useEffect, useState } from "react";
import { LabelVerification } from "@/lib/schemas";
import Link from "next/link";

export default function ReviewPage() {
  const [verifications, setVerifications] = useState<LabelVerification[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const data = sessionStorage.getItem("verifications");
    if (data) {
      try {
        const parsed = JSON.parse(data);
        setVerifications(parsed);
      } catch (error) {
        console.error("Error parsing verification data:", error);
      }
    }
  }, []);

  if (verifications.length === 0) {
    return (
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-6">Review Results</h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No verification results available. Please upload and process images first.
          </p>
          <Link
            href="/upload"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Go to Upload
          </Link>
        </div>
      </div>
    );
  }

  const currentVerification = verifications[selectedIndex];
  const passCount = verifications.filter((v) => v.overallStatus === "✅").length;
  const warningCount = verifications.filter((v) => v.overallStatus === "⚠️").length;
  const failCount = verifications.filter((v) => v.overallStatus === "❌").length;
  const escapeXml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  const handleExport = () => {
    const exportedAt = new Date().toISOString();
    const rows: string[] = [];
    const addRow = (cells: string[]) => {
      const row = cells
        .map(
          (cell) =>
            `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`
        )
        .join("");
      rows.push(`<Row>${row}</Row>`);
    };

    addRow([
      "Image Name",
      "Image Id",
      "Overall Status",
      "Evaluation Passed",
      "Field",
      "Status",
      "Message",
      "Expected",
      "Extracted",
    ]);

    verifications.forEach((verification) => {
      const evaluationPassed = verification.evaluation
        ? verification.evaluation.passed
          ? "passed"
          : "failed"
        : "missing";
      verification.results.forEach((result) => {
        addRow([
          verification.imageName,
          verification.imageId,
          verification.overallStatus,
          evaluationPassed,
          result.field,
          result.status,
          result.message ?? "",
          result.expected,
          result.extracted,
        ]);
      });
    });

    const workbook = [
      '<?xml version="1.0"?>',
      '<?mso-application progid="Excel.Sheet"?>',
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
      `<Worksheet ss:Name="Results"><Table>${rows.join("")}</Table></Worksheet>`,
      "</Workbook>",
    ].join("");

    const blob = new Blob([workbook], {
      type: "application/vnd.ms-excel",
    });
    const url = URL.createObjectURL(blob);
    const stamp = exportedAt.replace(/[:.]/g, "-");
    const link = document.createElement("a");
    link.href = url;
    link.download = `label-verifications-${stamp}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-6 text-center">Review Results</h1>

      {/* Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg">
            <div className="text-3xl font-bold text-green-600 dark:text-green-300">
              {passCount}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">✅ Passed</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg">
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-300">
              {warningCount}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">⚠️ Warnings</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900 p-4 rounded-lg">
            <div className="text-3xl font-bold text-red-600 dark:text-red-300">
              {failCount}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">❌ Failed</div>
          </div>
        </div>
      </div>

      {/* Image Selector */}
      {verifications.length > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Select Image</h2>
          <div className="flex flex-wrap gap-2">
            {verifications.map((verification, index) => (
              <button
                key={verification.imageId}
                onClick={() => setSelectedIndex(index)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  selectedIndex === index
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
                aria-label={`View results for ${verification.imageName}`}
                aria-pressed={selectedIndex === index}
              >
                {verification.overallStatus} {verification.imageName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {currentVerification.imageName}
          </h2>
          <div className="text-2xl">{currentVerification.overallStatus}</div>
        </div>

        {currentVerification.evaluation && (
          <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">AI Evaluation</h3>
              <span className="text-sm font-semibold">
                {currentVerification.evaluation.passed ? "✅ Passed" : "❌ Failed"}
              </span>
            </div>
          </div>
        )}

        {currentVerification.results.some(
          (result) => result.field === "Rule: Additive Disclosure"
        ) && (
          <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold">Additive Disclosure Checks</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Review any required additive disclosures (including sulfites).
            </p>
            <ul className="mt-3 text-sm text-gray-700 dark:text-gray-300 space-y-1">
              {currentVerification.results
                .filter((result) => result.field === "Rule: Additive Disclosure")
                .map((result, index) => (
                  <li key={`${result.field}-${index}`}>
                    {result.status} {result.message}
                  </li>
                ))}
            </ul>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">
                  Field
                </th>
                <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">
                  Expected
                </th>
                <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">
                  Extracted
                </th>
                <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                  Status
                </th>
                <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">
                  Message
                </th>
              </tr>
            </thead>
            <tbody>
              {currentVerification.results.map((result, index) => (
                <tr
                  key={index}
                  className={`${
                    result.status === "✅"
                      ? "bg-green-50 dark:bg-green-900/20"
                      : result.status === "⚠️"
                      ? "bg-yellow-50 dark:bg-yellow-900/20"
                      : "bg-red-50 dark:bg-red-900/20"
                  }`}
                >
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-semibold">
                    {result.field}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                    <div className="max-w-xs overflow-hidden text-ellipsis">
                      {result.expected.length > 100
                        ? result.expected.substring(0, 100) + "..."
                        : result.expected}
                    </div>
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                    <div className="max-w-xs overflow-hidden text-ellipsis">
                      {result.extracted.length > 100
                        ? result.extracted.substring(0, 100) + "..."
                        : result.extracted}
                    </div>
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center text-2xl">
                    {result.status}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm">
                    {result.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Expected Data</h2>
          <dl className="space-y-3">
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Brand
              </dt>
              <dd className="mt-1">{currentVerification.expectedData.brandName.text}</dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Class/Type
              </dt>
              <dd className="mt-1">{currentVerification.expectedData.classType.text}</dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Alcohol Content
              </dt>
              <dd className="mt-1">
                {currentVerification.expectedData.alcoholContent?.text ?? "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Net Contents
              </dt>
              <dd className="mt-1">{currentVerification.expectedData.netContents.text}</dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Bottler/Producer
              </dt>
              <dd className="mt-1">
                {currentVerification.expectedData.bottlerProducer?.text ?? "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Country of Origin
              </dt>
              <dd className="mt-1">
                {currentVerification.expectedData.countryOfOrigin?.text ?? "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Government Warning
              </dt>
              <dd className="mt-1 text-xs break-words">
                {currentVerification.expectedData.governmentWarning?.text ?? "Not provided"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Extracted Data</h2>
          <dl className="space-y-3">
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Brand
              </dt>
              <dd className="mt-1">
                {currentVerification.extractedData.brandName?.text ?? "Not found"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Class/Type
              </dt>
              <dd className="mt-1">
                {currentVerification.extractedData.classType?.text ?? "Not found"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Alcohol Content
              </dt>
              <dd className="mt-1">
                {currentVerification.extractedData.alcoholContent?.text ?? "Not found"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Net Contents
              </dt>
              <dd className="mt-1">
                {currentVerification.extractedData.netContents?.text ?? "Not found"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Bottler/Producer
              </dt>
              <dd className="mt-1">
                {currentVerification.extractedData.bottlerProducer?.text ?? "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Country of Origin
              </dt>
              <dd className="mt-1">
                {currentVerification.extractedData.countryOfOrigin?.text ?? "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Government Warning
              </dt>
              <dd className="mt-1 text-xs break-words">
                {currentVerification.extractedData.governmentWarning?.text ?? "Not found"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 justify-center">
        <button
          type="button"
          onClick={handleExport}
          className="bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
        >
          Export Results
        </button>
        <Link
          href="/upload"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Upload More
        </Link>
      </div>
    </div>
  );
}
