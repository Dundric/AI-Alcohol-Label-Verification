type SelectedFilesListProps = {
  files: File[];
};

export function SelectedFilesList({ files }: SelectedFilesListProps) {
  if (files.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="font-semibold mb-2">Selected Files:</h3>
      <ul className="list-disc list-inside space-y-1">
        {files.map((file, index) => (
          <li key={index} className="text-sm text-gray-600 dark:text-gray-400">
            {(file as File & { webkitRelativePath?: string }).webkitRelativePath ||
              file.name}{" "}
            ({(file.size / 1024).toFixed(2)} KB)
          </li>
        ))}
      </ul>
    </div>
  );
}
