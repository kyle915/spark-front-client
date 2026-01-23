import { createPortal } from "react-dom";

export function ImagePreviewModal({
  image,
  onClose,
}: {
  image: { name: string; file: string };
  onClose: () => void;
}) {
  return createPortal(
    <div className="modal modal-open">
      <div className="modal-box max-w-5xl">
        <div className="flex justify-between mb-3">
          <h3 className="font-bold">{image.name}</h3>
          <button className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <img src={image.file} className="max-h-[70vh] mx-auto rounded-lg" />
      </div>

      <div className="modal-backdrop" onClick={onClose} />
    </div>,
    document.body,
  );
}
