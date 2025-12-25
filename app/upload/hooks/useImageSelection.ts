import { useState, type ChangeEvent } from "react";
import { filterImageFiles } from "@/lib/upload/imageFiles";

export function useImageSelection(): {
  files: File[];
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleFolderChange: (event: ChangeEvent<HTMLInputElement>) => void;
} {
  const [files, setFiles] = useState<File[]>([]);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setFiles(filterImageFiles(fileList));
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
  };

  const handleFolderChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
  };

  return { files, handleFileChange, handleFolderChange };
}
