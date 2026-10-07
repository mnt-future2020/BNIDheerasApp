"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteMeeting } from "@/actions/meetings";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * Deletes a meeting. Its PALMS and recognitions are connected to it, so while
 * it has PALMS or published recognitions this only explains what to clear
 * first (the server enforces the same rule).
 */
export function DeleteMeetingButton({
  meetingId,
  when,
  records,
  recognitions,
  published,
  finalized,
  redirectTo,
  size = "default",
  variant = "destructive",
  iconOnly,
}: {
  meetingId: string;
  /** e.g. "Tue, 6 Oct, 2026 · 7:00 am" */
  when: string;
  /** PALMS: attendance rows recorded for the meeting. */
  records: number;
  /** Saved recognitions, of which `published` are published. */
  recognitions: number;
  published: number;
  finalized: boolean;
  redirectTo?: string;
  size?: "sm" | "default";
  variant?: "ghost" | "outline" | "destructive";
  /** Just the bin, for a row of meetings. */
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const hasPalms = records > 0 || finalized;
  const blocked = hasPalms || published > 0;
  const drafts = recognitions - published;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {iconOnly ? (
          <Button variant="ghost" size="icon-sm" aria-label="Delete meeting" title="Delete meeting">
            <Trash2Icon />
          </Button>
        ) : (
          <Button variant={variant} size={size}>
            Delete meeting
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        {blocked ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>The meeting on {when} can&apos;t be deleted yet</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p>
                    It has{" "}
                    {[hasPalms ? `PALMS (${plural(records, "attendance record")})` : null, published ? "published recognitions" : null]
                      .filter(Boolean)
                      .join(" and ")}
                    . They&apos;re connected to the meeting, so deleting it would delete them too.
                  </p>
                  {hasPalms ? (
                    <p>
                      A meeting that has PALMS stays, so its attendance history is never lost. Cancel it instead if it
                      didn&apos;t happen.
                    </p>
                  ) : null}
                  {published ? (
                    <p>To delete it, clear the recognitions first (Admin → Weekly recognitions → Clear all), then come back here.</p>
                  ) : null}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>OK</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete the meeting on {when}?</AlertDialogTitle>
              <AlertDialogDescription>
                It&apos;s removed from the schedule{drafts > 0 ? `, with its ${plural(drafts, "draft recognition")}` : ""}. Any
                leave or substitute requests for it go too. This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteMeeting(meetingId);
                    if (!res.ok) return void toast.error(res.error);
                    setOpen(false);
                    toast.success("Meeting deleted.");
                    if (redirectTo) router.push(redirectTo);
                    router.refresh();
                  })
                }
              >
                Delete meeting
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
