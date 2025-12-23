import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-6 text-center">
        Alcohol Label Verification System
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mb-6">
        <h2 className="text-2xl font-semibold mb-4">📋 Instructions</h2>
        
        <div className="space-y-6">
          <section>
            <h3 className="text-xl font-semibold mb-2">How It Works</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              This system uses AI-powered OCR to extract and verify information from alcohol labels.
              It compares extracted data against expected values and provides detailed verification results.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">Verified Fields</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li><strong>Brand Name:</strong> Fuzzy matching with normalization for punctuation and case</li>
              <li><strong>Class/Type:</strong> Product classification (e.g., "Tennessee Whiskey", "Red Wine")</li>
              <li><strong>ABV (Alcohol by Volume):</strong> Numeric comparison with tolerance</li>
              <li><strong>Net Contents:</strong> Volume with unit verification</li>
              <li><strong>Government Warning:</strong> Exact match required for legal compliance</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">Status Indicators</h3>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li><span className="text-green-600 font-bold">✅</span> Pass - Data matches expected values</li>
              <li><span className="text-yellow-600 font-bold">⚠️</span> Warning - Partial match or minor differences</li>
              <li><span className="text-red-600 font-bold">❌</span> Fail - Data does not match expected values</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">Getting Started</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>Navigate to the <strong>Upload</strong> page</li>
              <li>Upload a single image or multiple images in batch mode</li>
              <li>Provide expected label information for comparison</li>
              <li>Review the verification results on the <strong>Review</strong> page</li>
            </ol>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">Supported Formats</h3>
            <p className="text-gray-700 dark:text-gray-300">
              The system accepts common image formats including JPEG, PNG, and WebP.
              For best results, ensure labels are clearly visible and well-lit.
            </p>
          </section>
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/upload"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Start uploading labels"
          >
            Start Uploading →
          </Link>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>Note:</strong> This is a prototype system using mocked OCR for demonstration purposes.
          In production, this would connect to a real OCR service.
        </p>
      </div>
    </div>
  );
}
