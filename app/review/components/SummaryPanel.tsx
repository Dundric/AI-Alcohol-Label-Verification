type SummaryPanelProps = {
  passCount: number;
  warningCount: number;
  failCount: number;
};

export function SummaryPanel({
  passCount,
  warningCount,
  failCount,
}: SummaryPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Summary</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg">
          <div className="text-3xl font-bold text-green-600 dark:text-green-300">
            {passCount}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            ✅ Passed
          </div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg">
          <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-300">
            {warningCount}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            ⚠️ Warnings
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-900 p-4 rounded-lg">
          <div className="text-3xl font-bold text-red-600 dark:text-red-300">
            {failCount}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            ❌ Failed
          </div>
        </div>
      </div>
    </div>
  );
}
