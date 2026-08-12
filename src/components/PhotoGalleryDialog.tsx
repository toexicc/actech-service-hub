import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface GalleryPhoto {
  id: string;
  url: string;
}

interface PhotoGalleryDialogProps {
  photos: GalleryPhoto[];
  /** Index of the photo to show; null closes the dialog. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  title?: string;
  alt?: string;
}

/**
 * Shared gallery viewer for service photos: click a thumbnail to open, then
 * navigate with the arrows, keyboard, swipe, or the thumbnail strip without
 * having to close the dialog first.
 */
export const PhotoGalleryDialog = ({
  photos,
  index,
  onIndexChange,
  title = "Photo Preview",
  alt = "Photo",
}: PhotoGalleryDialogProps) => {
  const open = index !== null && index >= 0 && index < photos.length;
  const touchStartX = useRef<number | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const go = (delta: number) => {
    if (index === null || photos.length === 0) return;
    const next = (index + delta + photos.length) % photos.length;
    setZoomed(false);
    onIndexChange(next);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, photos.length]);

  useEffect(() => {
    if (!open) setZoomed(false);
  }, [open]);

  if (!open) return null;
  const current = photos[index as number];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onIndexChange(null);
      }}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{title}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {(index as number) + 1} of {photos.length}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div
          className="relative"
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchStartX.current;
            touchStartX.current = null;
            if (start === null) return;
            const delta = (e.changedTouches[0]?.clientX ?? start) - start;
            if (Math.abs(delta) > 50) go(delta < 0 ? 1 : -1);
          }}
        >
          <img
            src={current.url}
            alt={alt}
            onClick={() => setZoomed((z) => !z)}
            className={`mx-auto rounded-lg object-contain ${
              zoomed ? "max-w-none max-h-none w-auto cursor-zoom-out" : "max-w-full max-h-[70vh] cursor-zoom-in"
            }`}
          />

          {photos.length > 1 && (
            <>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full shadow-md"
                onClick={() => go(-1)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label="Next photo"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full shadow-md"
                onClick={() => go(1)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>

        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pt-2">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setZoomed(false);
                  onIndexChange(i);
                }}
                className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                  i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
