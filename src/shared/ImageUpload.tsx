import React, { useState, useRef } from "react";

interface ImageUploadProps {
    onImageSelected: (file: File | null) => void;
    onError?: (error: string) => void;
    currentImage?: string | null;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onImageSelected, onError, currentImage }) => {
    const [preview, setPreview] = useState<string | null>(currentImage || null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateFile = (file: File): string | null => {
        const validTypes = ["image/jpeg", "image/png", "image/webp"];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!validTypes.includes(file.type)) {
            return "Please select a valid image file (JPEG, PNG, or WebP)";
        }

        if (file.size > maxSize) {
            return "Image size must be less than 5MB";
        }

        return null;
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validationError = validateFile(file);
        if (validationError) {
            if (onError) {
                onError(validationError);
            }
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        onImageSelected(file);
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        const validationError = validateFile(file);
        if (validationError) {
            if (onError) {
                onError(validationError);
            }
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        onImageSelected(file);
    };

    const handleRemove = () => {
        setPreview(null);
        onImageSelected(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className="form-control w-full">
            <label className="label">
                <span className="label-text">Product Image (Optional)</span>
            </label>

            <div
                className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${dragActive ? "border-primary bg-primary/10" : "border-base-300"
                    }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                {preview ? (
                    <div className="relative">
                        <img
                            src={preview}
                            alt="Product preview"
                            className="max-h-64 mx-auto rounded-lg object-contain"
                        />
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="btn btn-sm btn-circle btn-error absolute top-2 right-2"
                        >
                            ✕
                        </button>
                    </div>
                ) : (
                    <div className="text-center">
                        <svg
                            className="mx-auto h-12 w-12 text-base-content/50"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                            aria-hidden="true"
                        >
                            <path
                                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <div className="mt-4">
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                Select Image
                            </button>
                        </div>
                        <p className="mt-2 text-xs text-base-content/60">
                            or drag and drop
                        </p>
                        <p className="text-xs text-base-content/60">
                            PNG, JPG, WebP up to 5MB
                        </p>
                    </div>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                />
            </div>
        </div>
    );
};

export default ImageUpload;
