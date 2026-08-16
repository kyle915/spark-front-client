import { PhotoLightbox } from "@/shared/PhotoLightbox";

export function ImagePreviewModal({
  image,
  images,
  index = 0,
  onClose,
  onNext,
  onPrev,
  onIndex,
}: {
  image: { name: string; file: string };
  images?: ReadonlyArray<{ name: string; file: string }>;
  index?: number;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onIndex?: (next: number) => void;
}) {
  const photos = (images && images.length > 0 ? images : [image]).map((item) => ({
    name: item.name,
    url: item.file,
  }));
  const current = Math.min(Math.max(index, 0), photos.length - 1);

  return (
    <PhotoLightbox
      photos={photos}
      index={current}
      loop={photos.length > 1}
      onClose={onClose}
      onStep={(next) => {
        if (onIndex) {
          onIndex(next);
          return;
        }
        if (next > current) onNext?.();
        else onPrev?.();
      }}
    />
  );
}
