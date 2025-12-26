import type { ChangeEvent } from "react";
import type { UploadMode } from "./ModeSelector";
import { FilePicker } from "./FilePicker";
import { FolderPicker } from "./FolderPicker";
import { SelectedFilesList } from "./SelectedFilesList";

type ImageUploadCardProps = {
  mode: UploadMode;
  files: File[];
  fileError?: string | null;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFolderChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function ImageUploadCard({
  mode,
  files,
  fileError,
  onFileChange,
  onFolderChange,
}: ImageUploadCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Select Images</h2>
      <FilePicker mode={mode} onChange={onFileChange} />
      {mode === "batch" && <FolderPicker onChange={onFolderChange} />}
      {fileError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {fileError}
        </p>
      )}
      <SelectedFilesList files={files} />
    </div>
  );
}
