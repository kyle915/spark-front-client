import { createPortal } from "react-dom";
import { useRef } from "react";

export function ImagePreviewModal({
  image,
  onClose,
  onNext,
  onPrev,
}: {
  image: { name: string; file: string };
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const swipeThreshold = 50;

  const handleTouchStart = (event: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    touchEndX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const delta = touchStartX.current - touchEndX.current;
    if (Math.abs(delta) < swipeThreshold) return;
    if (delta > 0) {
      onNext?.();
    } else {
      onPrev?.();
    }
  };

  return createPortal(
    <div className="modal modal-open">
      <div className="modal-box max-w-5xl">
        <div className="flex justify-between mb-3">
          <h3 className="font-bold">{image.name}</h3>
          <button className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <img
          src={image.file}
          className="max-h-[70vh] mx-auto rounded-lg"
          onError={(event) => {
            console.error("Preview image failed to render", {
              name: image.name,
              src: image.file,
              currentSrc: event.currentTarget.currentSrc,
              naturalWidth: event.currentTarget.naturalWidth,
              naturalHeight: event.currentTarget.naturalHeight,
            });
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>

      <div className="modal-backdrop" onClick={onClose} />
    </div>,
    document.body,
  );
}
