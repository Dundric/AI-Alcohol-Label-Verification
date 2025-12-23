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
              <dd className="mt-1">{currentVerification.expectedData.brand}</dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Class/Type
              </dt>
              <dd className="mt-1">{currentVerification.expectedData.classType}</dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                ABV
              </dt>
              <dd className="mt-1">{currentVerification.expectedData.abv}</dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Net Contents
              </dt>
              <dd className="mt-1">{currentVerification.expectedData.netContents}</dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Government Warning
              </dt>
              <dd className="mt-1 text-xs break-words">
                {currentVerification.expectedData.govWarning}
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
              <dd className="mt-1">{currentVerification.extractedData.brand}</dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Class/Type
              </dt>
              <dd className="mt-1">{currentVerification.extractedData.classType}</dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                ABV
              </dt>
              <dd className="mt-1">{currentVerification.extractedData.abv}</dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Net Contents
              </dt>
              <dd className="mt-1">{currentVerification.extractedData.netContents}</dd>
            </div>
            <div>
              <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                Government Warning
              </dt>
              <dd className="mt-1 text-xs break-words">
                {currentVerification.extractedData.govWarning}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 justify-center">
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
