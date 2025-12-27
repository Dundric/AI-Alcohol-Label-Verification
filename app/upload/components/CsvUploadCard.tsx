import type { ChangeEvent } from "react";
import Link from "next/link";
import type { CsvExpectedMap } from "@/lib/upload/expectedCsv";

type CsvUploadCardProps = {
  csvError: string | null;
  csvExpectedMap: CsvExpectedMap | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function CsvUploadCard({
  csvError,
  csvExpectedMap,
  onChange,
}: CsvUploadCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      {/* Updated Heading */}
      <h2 className="text-xl font-semibold mb-1">Expected Data CSV</h2>
      
      {/* New Subtitle */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Download{" "}
        <Link 
          href="/Table-Example.csv" 
          className="text-purple-500 hover:underline font-medium"
        >
          Template CSV Example
        </Link>
      </p>

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
        onChange={onChange}
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
  );
}