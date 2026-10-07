"use client";

import { RotateCcwIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { encodeCanvas, squareCanvas } from "@/lib/image-compress";
import { cn } from "@/lib/utils";

/** Side of the square that gets uploaded, per kind. */
const OUTPUT = { photo: 800, logo: 600 } as const;
const MAX_ZOOM = 4;

type Point = { x: number; y: number };

/**
 * Drag to move, slider or wheel to zoom, then save. A photo starts filling the
 * circle; a logo starts fully visible inside the square, so a wide logo isn't
 * cropped unless the member chooses to.
 */
export function ImageCropDialog({
  file,
  kind,
  label,
  rounded,
  onCancel,
  onDone,
}: {
  file: File;
  kind: "photo" | "logo";
  label: string;
  rounded?: boolean;
  onCancel: (error?: string) => void;
  onDone: (blob: Blob) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [view, setView] = useState(0);
  const [zoom, setZoom] = useState(1);
  /** Which point of the image sits in the middle, as a 0–1 fraction of its size. */
  const [focus, setFocus] = useState<Point>({ x: 0.5, y: 0.5 });
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ from: Point; start: Point } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setImg(image);
    };
    image.onerror = () => {
      // Revoking the URL below aborts a load still in flight (Strict Mode runs
      // this effect twice): that's a discarded attempt, not a bad file.
      if (!cancelled) onCancel("This image format isn't supported. Use JPG or PNG.");
    };
    image.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // The viewport is responsive, so every measurement is in its current pixels.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setView(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  // "1×" means filling the circle for a photo, and fitting inside for a logo.
  const base = img && view ? (kind === "photo" ? view / Math.min(img.width, img.height) : view / Math.max(img.width, img.height)) : 0;
  const width = img ? img.width * base * zoom : 0;
  const height = img ? img.height * base * zoom : 0;

  /** Keeps the image over the viewport: no empty edge once it's big enough to cover. */
  const clamp = useCallback(
    (p: Point, w: number, h: number): Point => ({
      x: w >= view ? Math.min(0, Math.max(view - w, p.x)) : Math.min(view - w, Math.max(0, p.x)),
      y: h >= view ? Math.min(0, Math.max(view - h, p.y)) : Math.min(view - h, Math.max(0, p.y)),
    }),
    [view],
  );

  // Derived, never stored: centring and zooming then need no effect, and the
  // framing survives a zoom because `focus` is in image units, not pixels.
  const pos = clamp({ x: view / 2 - focus.x * width, y: view / 2 - focus.y * height }, width, height);

  const reset = () => {
    setZoom(1);
    setFocus({ x: 0.5, y: 0.5 });
  };

  /** Moves the image to `p`, remembering it as a fraction of the image. */
  const moveTo = (p: Point) => {
    if (!width || !height) return;
    const next = clamp(p, width, height);
    setFocus({ x: (view / 2 - next.x) / width, y: (view / 2 - next.y) / height });
  };

  async function save() {
    if (!img || !view) return;
    setBusy(true);
    try {
      const size = OUTPUT[kind];
      const factor = size / view;
      const { canvas, ctx } = squareCanvas(size);
      ctx.drawImage(img, pos.x * factor, pos.y * factor, width * factor, height * factor);
      onDone(await encodeCanvas(canvas));
    } catch (e) {
      onCancel((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Position your {label.toLowerCase()}</DialogTitle>
          <DialogDescription>Drag to move it, and zoom until it looks right.</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          <div
            ref={box}
            className={cn(
              "relative aspect-square w-full max-w-72 touch-none overflow-hidden border bg-muted select-none",
              rounded ? "rounded-full" : "rounded-xl",
              img ? "cursor-grab active:cursor-grabbing" : "",
            )}
            onPointerDown={(e) => {
              if (!img) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { from: { x: e.clientX, y: e.clientY }, start: pos };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              moveTo({ x: d.start.x + (e.clientX - d.from.x), y: d.start.y + (e.clientY - d.from.y) });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onWheel={(e) => setZoom((z) => Math.min(MAX_ZOOM, Math.max(1, z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))))}
          >
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img.src}
                alt=""
                draggable={false}
                className="absolute max-w-none"
                style={{ left: pos.x, top: pos.y, width, height }}
              />
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ZoomOutIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            aria-label="Zoom"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!img}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
          <ZoomInIcon className="size-4 shrink-0 text-muted-foreground" />
          <Button type="button" variant="ghost" size="icon-sm" title="Reset" aria-label="Reset" onClick={reset} disabled={!img}>
            <RotateCcwIcon />
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onCancel()} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={!img || busy}>
            {busy ? "Saving…" : `Save ${label.toLowerCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
