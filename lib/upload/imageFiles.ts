import { IMAGE_EXTENSIONS } from "@/lib/upload/constants";

export function filterImageFiles(fileList: FileList): File[] {
  return Array.from(fileList).filter((file) => {
    if (file.type.startsWith("image/")) return true;
    const lowerName = file.name.toLowerCase();
    return IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  });
}
