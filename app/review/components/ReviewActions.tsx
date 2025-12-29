import Link from "next/link";

type ReviewActionsProps = {
  onExport: () => void;
};

export function ReviewActions({ onExport }: ReviewActionsProps) {
  return (
    <div className="flex gap-4 justify-center">
      <button
        type="button"
        onClick={onExport}
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
  );
}
