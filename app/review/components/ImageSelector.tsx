import type { LabelVerification } from "@/lib/schemas";

type ImageSelectorProps = {
  verifications: LabelVerification[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

export function ImageSelector({
  verifications,
  selectedIndex,
  onSelect,
}: ImageSelectorProps) {
  if (verifications.length <= 1) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Select Image</h2>
      <div className="flex flex-wrap gap-2">
        {verifications.map((verification, index) => (
          <button
            key={verification.imageId}
            onClick={() => onSelect(index)}
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
  );
}
