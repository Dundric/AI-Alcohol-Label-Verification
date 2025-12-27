import type { AdditiveDisclosure, ExpectedAlcoholLabel } from "@/lib/schemas";
import type { ExpectedDataHandlers } from "../hooks/useExpectedLabelForm";

type ExpectedDataFormProps = {
  expectedData: ExpectedAlcoholLabel;
  handlers: ExpectedDataHandlers;
};

const additiveOptions: Array<{
  key: keyof AdditiveDisclosure;
  label: string;
}> = [
  { key: "fdcYellowNo5", label: "FD&C Yellow No. 5" },
  { key: "cochinealExtract", label: "cochineal extract" },
  { key: "carmine", label: "carmine" },
  { key: "aspartame", label: "aspartame" },
  { key: "sulfitesGe10ppm", label: "sulfites >= 10PPM" },
];

export function ExpectedDataForm({ expectedData, handlers }: ExpectedDataFormProps) {
  const requiredFields = [
    {
      id: "brand",
      label: "Brand Name",
      value: expectedData.brandName.text,
      onChange: (value: string) =>
        handlers.updateRequiredField("brandName", value),
    },
    {
      id: "classType",
      label: "Class/Type",
      value: expectedData.classType.text,
      onChange: (value: string) =>
        handlers.updateRequiredField("classType", value),
    },
    {
      id: "netContents",
      label: "Net Contents",
      value: expectedData.netContents.text,
      placeholder: "e.g., 750ml",
      onChange: (value: string) =>
        handlers.updateRequiredField("netContents", value),
    },
    {
      id: "bottlerProducer",
      label: "Bottler/Producer",
      value: expectedData.bottlerProducer.text,
      onChange: (value: string) =>
        handlers.updateRequiredField("bottlerProducer", value),
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Expected Label Data</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Enter the expected values to compare against the extracted data.
      </p>
      <div className="space-y-4">
        {requiredFields.map((field) => (
          <div key={field.id}>
            <label htmlFor={field.id} className="block font-semibold mb-1">
              {field.label}
            </label>
            <input
              id={field.id}
              type="text"
              value={field.value}
              onChange={(event) => field.onChange(event.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={`Expected ${field.label.toLowerCase()}`}
            />
          </div>
        ))}
        <div>
          <label htmlFor="alcoholContent" className="block font-semibold mb-1">
            Alcohol Content (Optional for beer/malt liquor)
          </label>
          <input
            id="alcoholContent"
            type="text"
            value={expectedData.alcoholContent?.text ?? ""}
            onChange={(event) =>
              handlers.updateAlcoholContent(event.target.value)
            }
            placeholder="e.g., 40%"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Expected alcohol content"
          />
        </div>
        <div>
          <label htmlFor="countryOfOrigin" className="block font-semibold mb-1">
            Country of Origin (Optional)
          </label>
          <input
            id="countryOfOrigin"
            type="text"
            value={expectedData.countryOfOrigin?.text ?? ""}
            onChange={(event) =>
              handlers.updateOptionalField("countryOfOrigin", event.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Expected country of origin"
          />
        </div>
        <div>
          <label htmlFor="ageYears" className="block font-semibold mb-1">
            Age (Years) (Optional)
          </label>
          <input
            id="ageYears"
            type="number"
            min="0"
            step="0.1"
            value={expectedData.ageYears ?? ""}
            onChange={(event) => handlers.updateAgeYears(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Expected age in years"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="isImported"
            type="checkbox"
            checked={expectedData.isImported}
            onChange={(event) =>
              handlers.updateFlag("isImported", event.target.checked)
            }
            className="w-4 h-4"
            aria-label="Product is imported"
          />
          <label htmlFor="isImported" className="font-semibold">
            Imported Product
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="beerHasAddedFlavorsWithAlcohol"
            type="checkbox"
            checked={expectedData.beerHasAddedFlavorsWithAlcohol}
            onChange={(event) =>
              handlers.updateFlag(
                "beerHasAddedFlavorsWithAlcohol",
                event.target.checked
              )
            }
            className="w-4 h-4"
            aria-label="Beer has alcohol from added flavors"
          />
          <label
            htmlFor="beerHasAddedFlavorsWithAlcohol"
            className="font-semibold"
          >
            Beer contains alcohol from added flavors
          </label>
        </div>
        <div>
          <span className="block font-semibold mb-2">Additives Detected</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {additiveOptions.map((option) => (
              <label key={option.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={expectedData.additivesDetected[option.key]}
                  onChange={(event) =>
                    handlers.updateAdditive(option.key, event.target.checked)
                  }
                  className="w-4 h-4"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300">
          Government warning is always assumed to be the standard text.
        </div>
      </div>
    </div>
  );
}
