import type { LabelVerification } from "@/lib/schemas";

type AIEvaluationPanelProps = {
  evaluation: LabelVerification["evaluation"] | null | undefined;
};

export function AIEvaluationPanel({ evaluation }: AIEvaluationPanelProps) {
  if (!evaluation) {
    return null;
  }

  return (
    <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">AI Evaluation</h3>
        <span className="text-sm font-semibold">
          {evaluation.passed ? "✅ Passed" : "❌ Failed"}
        </span>
      </div>
    </div>
  );
}
