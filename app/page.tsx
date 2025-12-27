import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-6 text-center">
        Alcohol Label Verification System
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 mb-6">
        <h2 className="text-2xl font-semibold mb-6 border-b pb-2">📋 System Instructions</h2>

        <div className="space-y-10">
          
          {/* Section 1: Single Processing */}
          <section className="relative pl-8 border-l-4 border-blue-500">
            <div className="absolute -left-[18px] top-0 bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md">
              1
            </div>
            <h3 className="text-2xl font-bold mb-4">Single Label Verification</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Best for evaluating a single product label in real-time. This mode allows you to manually input expected data to test extraction accuracy.
            </p>
            <ul className="list-decimal list-inside space-y-3 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/40 p-5 rounded-lg">
              <li>Navigate to the <strong>Upload</strong> page and ensure "Single" is selected.</li>
              <li>Upload your label image. [View <Link href="/Fireball.jpg" className="text-blue-500 hover:underline">Label Example</Link>]</li>
               <span className="text-sm block mt-1 text-gray-500 italic">(Note: Please combine all relevant sections (Front, Back, Sides) into a single image file).</span>
              <li>Enter the <strong>Expected Label Data</strong> into the provided form fields for the AI to compare against.</li>
              <li>Click "Process & Verify Labels" and view the detailed breakdown on the <strong>Review</strong> page.</li>
            </ul>
          </section>

          {/* Section 2: Batch Processing */}
          <section className="relative pl-8 border-l-4 border-purple-500">
            <div className="absolute -left-[18px] top-0 bg-purple-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md">
              2
            </div>
            <h3 className="text-2xl font-bold mb-4">Batch Processing</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Automate the verification of multiple labels simultaneously using a CSV or Excel data source.
            </p>
            <ul className="list-decimal list-inside space-y-3 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/40 p-5 rounded-lg">
              <li>Select the <strong>Batch</strong> option on the Upload page.</li>
              <li>
                <strong>Upload Images:</strong> Select multiple label image files or an entire folder. 
                <span className="text-sm block mt-1 text-gray-500 italic">(Note: Folder upload is supported in Chromium-based browsers like Chrome or Edge).</span>
              </li>
              <li>
                <strong>Upload Data:</strong> Provide a CSV or Excel file. 
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-sm">
                  <li>The file should be exportable directly from the COLA system.</li>
                  <li><strong>Critical:</strong> The "Filename" column in your CSV must match your image filenames exactly.</li>
                  <li>[Download <Link href="/Table-Example.csv" className="text-purple-500 hover:underline font-medium">Template CSV Example</Link>]</li>
                </ul>
              </li>
              <li>Review the bulk status (Pass/Fail/Warning) of all labels on the <strong>Review</strong> dashboard.</li>
            </ul>
          </section>

          {/* Section 3: Verification Logic */}
          <section className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-xl border border-blue-100 dark:border-blue-800">
            <h3 className="text-xl font-semibold mb-4 text-blue-800 dark:text-blue-300">What We Check</h3>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-6 text-sm">
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Brand Name</p>
                <p className="text-gray-600 dark:text-gray-400">Fuzzy matching that accounts for punctuation and case variations.</p>
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Class/Type</p>
                <p className="text-gray-600 dark:text-gray-400">Validation against TTB regulated alcohol categories (e.g., "Vodka", "Ale").</p>
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">ABV & Net Contents</p>
                <p className="text-gray-600 dark:text-gray-400">Numeric verification of alcohol percentage and volume (e.g., "750 ML").</p>
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Bottler & Producer</p>
                <p className="text-gray-600 dark:text-gray-400">Full name and address verification for the bottler/producer.</p>
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Government Warning</p>
                <p className="text-gray-600 dark:text-gray-400">Ensures the standard health statement and formatting are present.</p>
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Country of Origin</p>
                <p className="text-gray-600 dark:text-gray-400">Verification of import origins as required by TTB standards.</p>
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Additives Disclosure</p>
                <p className="text-gray-600 dark:text-gray-400">Detection of sulfites, aspartame, and color additives (Yellow No. 5, Carmine).</p>
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Compliance Flags</p>
                <p className="text-gray-600 dark:text-gray-400">Verification of typography rules, such as bolding and all-caps headers.</p>
              </div>
            </div>
          </section>

          {/* Section 4: Tips */}
          <section>
            <h3 className="text-xl font-semibold mb-3">Tips for Better Matches</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>Use <strong>sharp, well-lit images</strong> with minimal glare.</li>
              <li>Capture the <strong>full label</strong>, specifically ensuring the warning text is legible.</li>
              <li>Supported formats include <strong>JPEG, PNG, and WebP</strong>.</li>
            </ul>
          </section>
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            href="/upload"
            className="bg-blue-600 text-white px-10 py-4 rounded-lg font-bold text-xl hover:bg-blue-700 transition-all shadow-lg hover:scale-105"
          >
            Start Uploading →
          </Link>
        </div>
      </div>
    </div>
  );
}