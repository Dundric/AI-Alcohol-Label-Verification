import { useState, type ChangeEvent } from "react";
import { filterImageFiles } from "@/lib/upload/imageFiles";
import { MAX_UPLOAD_BYTES } from "@/lib/upload/constants";

export function useImageSelection(): {
  files: File[];
  fileError: string | null;
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleFolderChange: (event: ChangeEvent<HTMLInputElement>) => void;
} {
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const buildFileError = (rejected: File[]) => {
    if (rejected.length === 0) return null;
    const names = rejected.map((file) => file.name);
    const preview = names.slice(0, 3).join(", ");
    const suffix = names.length > 3 ? `, and ${names.length - 3} more` : "";
    return `Skipped ${rejected.length} file(s) over 10 MB: ${preview}${suffix}.`;
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const images = filterImageFiles(fileList);
    const accepted = images.filter((file) => file.size <= MAX_UPLOAD_BYTES);
    const rejected = images.filter((file) => file.size > MAX_UPLOAD_BYTES);

    setFiles(accepted);
    setFileError(buildFileError(rejected));
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
  };

  const handleFolderChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
  };

  return { files, fileError, handleFileChange, handleFolderChange };
}
