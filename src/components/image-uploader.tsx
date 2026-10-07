"use client";

import { CameraIcon, Loader2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageCropDialog } from "@/components/image-crop-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Pick → position and zoom it in the browser → POST to /api/uploads (stored in
 * the bucket) → hand the stored key to `onUploaded`, which saves it on the member.
 */
export function ImageUploader({
  kind,
  currentUrl,
  label,
  rounded,
  onUploaded,
}: {
  kind: "photo" | "logo";
  currentUrl: string | null;
  label: string;
  rounded?: boolean;
  onUploaded: (key: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(currentUrl);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<File | null>(null);

  async function upload(blob: Blob) {
    setPicked(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/uploads?kind=${kind}`, {
        method: "POST",
        body: blob,
        headers: { "Content-Type": blob.type },
      });
      const data = (await res.json().catch(() => ({}))) as { key?: string; error?: string };
      if (!res.ok || !data.key) throw new Error(data.error ?? "Upload failed. Check your connection and try again.");
      const saved = await onUploaded(data.key);
      if (!saved.ok) throw new Error(saved.error ?? "Couldn't save the image.");
      setPreview(URL.createObjectURL(blob));
      toast.success(`${label} updated.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "flex size-20 shrink-0 items-center justify-center overflow-hidden border bg-muted",
          rounded ? "rounded-full" : "rounded-xl",
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className={cn("size-full", kind === "logo" ? "object-contain" : "object-cover")} />
        ) : (
          <CameraIcon className="size-6 text-muted-foreground" />
        )}
      </div>
      <div>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2Icon className="animate-spin" /> : null}
          {preview ? `Change ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">JPG or PNG. You can zoom and position it next.</p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Clear it now so picking the same file again still reopens the dialog.
          e.target.value = "";
          if (file) setPicked(file);
        }}
      />
      {picked ? (
        <ImageCropDialog
          file={picked}
          kind={kind}
          label={label}
          rounded={rounded}
          onCancel={(error) => {
            setPicked(null);
            if (error) toast.error(error);
          }}
          onDone={upload}
        />
      ) : null}
    </div>
  );
}
