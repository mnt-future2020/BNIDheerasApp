/**
 * Encodes a canvas for upload: WebP where the browser can (or JPEG, e.g. older
 * Safari), on a white background. Pictures are cropped to a square in
 * `ImageCropDialog` before they get here, so a phone photo of 3–5 MB ends up
 * around 100–250 KB.
 */
export async function encodeCanvas(canvas: HTMLCanvasElement, quality = 0.82): Promise<Blob> {
  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob("image/jpeg");
  if (!jpeg) throw new Error("Couldn't process this image.");
  return jpeg;
}

/** A square canvas filled white, ready to draw the cropped image onto. */
export function squareCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  return { canvas, ctx };
}
