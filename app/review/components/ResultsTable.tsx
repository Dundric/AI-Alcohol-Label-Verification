import type { VerificationResult } from "@/lib/schemas";

type ResultsTableProps = {
  results: VerificationResult[];
};

export function ResultsTable({ results }: ResultsTableProps) {
  return (
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
          {results.map((result, index) => (
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
  );
}
