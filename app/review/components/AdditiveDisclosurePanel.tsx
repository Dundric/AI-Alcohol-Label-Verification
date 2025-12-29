import type { VerificationResult } from "@/lib/schemas";

type AdditiveDisclosurePanelProps = {
  results: VerificationResult[];
};

export function AdditiveDisclosurePanel({
  results,
}: AdditiveDisclosurePanelProps) {
  const additiveResults = results.filter(
    (result) => result.field === "Rule: Additive Disclosure"
  );
  if (additiveResults.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="font-semibold">Additive Disclosure Checks</h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        Review any required additive disclosures (including sulfites).
      </p>
      <ul className="mt-3 text-sm text-gray-700 dark:text-gray-300 space-y-1">
        {additiveResults.map((result, index) => (
          <li key={`${result.field}-${index}`}>
            {result.status} {result.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
