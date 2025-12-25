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
            <h3 className="text-xl font-semibold mb-2">Quick Start</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>Go to <strong>Upload</strong> and pick Single or Batch.</li>
              <li>Select label images (Batch supports folders in Chromium).</li>
              <li>Single: enter expected label data for comparison.</li>
              <li>Batch: upload a CSV to match expected data by filename.</li>
              <li>Review results on the <strong>Review</strong> page.</li>
            </ol>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">What We Check</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li><strong>Brand Name:</strong> fuzzy match with punctuation/case normalization</li>
              <li><strong>Class/Type:</strong> regulated class or type on the label</li>
              <li><strong>ABV:</strong> numeric comparison with tolerance</li>
              <li><strong>Net Contents:</strong> value and unit match</li>
              <li><strong>Government Warning:</strong> exact or standard wording</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">Result Status</h3>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li><span className="text-green-600 font-bold">✅</span> Pass - expected and extracted data align</li>
              <li><span className="text-yellow-600 font-bold">⚠️</span> Warning - partial or close match</li>
              <li><span className="text-red-600 font-bold">❌</span> Fail - mismatch or missing data</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">Tips for Better Matches</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>Use sharp, well-lit images with minimal glare.</li>
              <li>Capture the full label, especially the warning text.</li>
              <li>Match CSV filenames to the uploaded images exactly.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-2">Supported Formats</h3>
            <p className="text-gray-700 dark:text-gray-300">
              JPEG, PNG, and WebP are supported. Larger, clearer images
              generally improve extraction accuracy.
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
    </div>
  );
}
