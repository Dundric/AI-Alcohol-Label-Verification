import type { ExtractedAlcoholLabel } from "@/lib/schemas";

type ExtractedDataPanelProps = {
  data: ExtractedAlcoholLabel;
};

export function ExtractedDataPanel({ data }: ExtractedDataPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Extracted Data</h2>
      <dl className="space-y-3">
        <div>
          <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
            Brand
          </dt>
          <dd className="mt-1">{data.brandName?.text ?? "Not found"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
            Class/Type
          </dt>
          <dd className="mt-1">{data.classType?.text ?? "Not found"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
            Alcohol Content
          </dt>
          <dd className="mt-1">{data.alcoholContent?.text ?? "Not found"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
            Net Contents
          </dt>
          <dd className="mt-1">{data.netContents?.text ?? "Not found"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
            Bottler/Producer
          </dt>
          <dd className="mt-1">
            {data.bottlerProducer?.text ?? "Not provided"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
            Country of Origin
          </dt>
          <dd className="mt-1">
            {data.countryOfOrigin?.text ?? "Not provided"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-sm text-gray-600 dark:text-gray-400">
            Government Warning
          </dt>
          <dd className="mt-1 text-xs break-words">
            {data.governmentWarning?.text ?? "Not found"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
