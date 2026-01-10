import { useState } from "react";

type FileTypeOption = {
  value: string;
  label: string;
};

type FileUploadItemProps = {
  index: number;
  fileTypeOptions: FileTypeOption[];
  fileRecapCategoryOptions: FileTypeOption[];
  fileTypeId: string;
  fileRecapCategoryId: string;
  onFileSelected: (file: File | null, index: number) => void;
  onFileTypeSelected: (fileTypeId: string, index: number) => void;
  onFileRecapCategorySelected: (
    fileRecapCategoryId: string,
    index: number
  ) => void;
  onRemove: (index: number) => void;
  onError: (error: string) => void;
};

const FileUploadItem = ({
  index,
  fileTypeOptions,
  fileRecapCategoryOptions,
  fileTypeId,
  fileRecapCategoryId,
  onFileSelected,
  onFileTypeSelected,
  onFileRecapCategorySelected,
  onRemove,
  onError,
}: FileUploadItemProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      onFileSelected(null, index);
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      onError("File size must be less than 10MB");
      event.target.value = "";
      return;
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      onError("Only images (JPEG, PNG, GIF, WEBP) and PDF files are allowed");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    onFileSelected(file, index);

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    onFileSelected(null, index);
    onFileTypeSelected("", index);
    onFileRecapCategorySelected("", index);
    onRemove(index);
  };

  const handleFileTypeChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    onFileTypeSelected(event.target.value, index);
  };

  const handleFileRecapCategoryChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    onFileRecapCategorySelected(event.target.value, index);
  };

  return (
    <div className="border border-base-300 rounded-lg p-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <label className="label">
            <span className="label-text">File {index + 1}</span>
          </label>
          <input
            type="file"
            className="file-input file-input-bordered w-full"
            onChange={handleFileChange}
            accept="image/*,.pdf"
          />
          <div className="mt-2">
            <label className="label">
              <span className="label-text text-xs">File Type</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={fileTypeId}
              onChange={handleFileTypeChange}
              disabled={fileTypeOptions.length === 0}
            >
              <option value="">Select file type</option>
              {fileTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2">
            <label className="label">
              <span className="label-text text-xs">File Recap Category</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={fileRecapCategoryId}
              onChange={handleFileRecapCategoryChange}
              disabled={fileRecapCategoryOptions.length === 0}
            >
              <option value="">Select recap category</option>
              {fileRecapCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {selectedFile && (
            <div className="mt-2 text-sm text-base-content/70">
              <p>
                <strong>Name:</strong> {selectedFile.name}
              </p>
              <p>
                <strong>Size:</strong> {(selectedFile.size / 1024).toFixed(2)}{" "}
                KB
              </p>
              <p>
                <strong>Type:</strong> {selectedFile.type}
              </p>
            </div>
          )}
        </div>

        {previewUrl && (
          <div className="w-24 h-24 shrink-0">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-full object-cover rounded-lg"
            />
          </div>
        )}

        <button
          type="button"
          className="btn btn-error btn-sm"
          onClick={handleRemove}
          aria-label="Remove file"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default FileUploadItem;
