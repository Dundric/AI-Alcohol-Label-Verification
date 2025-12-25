import type { ChangeEvent } from "react";

type FolderPickerProps = {
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function FolderPicker({ onChange }: FolderPickerProps) {
  return (
    <div className="mb-4">
      <label
        htmlFor="folder-upload"
        className="block w-full px-4 py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center cursor-pointer hover:border-blue-500 transition-colors"
      >
        <span className="text-3xl mb-2 block">🗂️</span>
        <span className="text-gray-600 dark:text-gray-400">
          Or select a folder of images (Chromium browsers)
        </span>
        <input
          id="folder-upload"
          type="file"
          accept="image/*"
          multiple
          onChange={onChange}
          className="hidden"
          // @ts-expect-error webkitdirectory is supported in Chromium
          webkitdirectory="true"
        />
      </label>
    </div>
  );
}
