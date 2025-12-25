import type { ChangeEvent } from "react";
import type { UploadMode } from "./ModeSelector";

type FilePickerProps = {
  mode: UploadMode;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function FilePicker({ mode, onChange }: FilePickerProps) {
  return (
    <div className="mb-4">
      <label
        htmlFor="file-upload"
        className="block w-full px-4 py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center cursor-pointer hover:border-blue-500 transition-colors"
      >
        <span className="text-4xl mb-2 block">📁</span>
        <span className="text-gray-600 dark:text-gray-400">
          Click to select {mode === "single" ? "an image" : "images"}
        </span>
        <input
          id="file-upload"
          type="file"
          accept="image/*"
          multiple={mode === "batch"}
          onChange={onChange}
          className="hidden"
          aria-label={`Upload ${mode === "single" ? "single" : "multiple"} image(s)`}
        />
      </label>
    </div>
  );
}
