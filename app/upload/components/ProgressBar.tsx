type ProgressBarProps = {
  progress: number;
};

export function ProgressBar({ progress }: ProgressBarProps) {
  return (
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
  );
}
