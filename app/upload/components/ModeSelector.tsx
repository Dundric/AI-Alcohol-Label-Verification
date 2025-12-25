import type { ChangeEvent } from "react";

export type UploadMode = "single" | "batch";

type ModeSelectorProps = {
  mode: UploadMode;
  onChange: (mode: UploadMode) => void;
};

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value as UploadMode);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Upload Mode</h2>
      <div className="flex gap-4" role="radiogroup" aria-label="Upload mode selection">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="mode"
            value="single"
            checked={mode === "single"}
            onChange={handleChange}
            className="w-4 h-4"
            aria-label="Single image upload mode"
          />
          <span>Single Image</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="mode"
            value="batch"
            checked={mode === "batch"}
            onChange={handleChange}
            className="w-4 h-4"
            aria-label="Batch image upload mode"
          />
          <span>Batch Upload</span>
        </label>
      </div>
    </div>
  );
}
