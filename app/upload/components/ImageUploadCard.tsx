import type { ChangeEvent } from "react";
import type { UploadMode } from "./ModeSelector";
import { FilePicker } from "./FilePicker";
import { FolderPicker } from "./FolderPicker";
import { SelectedFilesList } from "./SelectedFilesList";
import Link from "next/link";

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
      {/* Main Title - reduced bottom margin */}
      <h2 className="text-xl font-semibold mb-1">Select Label Image</h2>
      
      {/* Subtitle with View link */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        View{" "}
        <Link 
          href="/Fireball.jpg" 
          className="text-blue-500 hover:underline font-medium"
        >
          Label Example
        </Link>
      </p>

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