"use client";

import { LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { lvhFinalize } from "@/actions/lvh";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Closes the meeting from the PALMS screen, where the statuses were just
 * entered. Everyone still blank becomes Absent (or Medical with approved
 * leave), so the dialog says what is about to happen before it locks.
 */
export function FinalizeMeetingButton({
  meetingId,
  headcount,
  visitorsEntered,
  inRoom,
  blanks,
  pendingMedical,
  unconfirmedSubs,
}: {
  meetingId: string;
  /** Counted in the room, or null when nobody counted. */
  headcount: number | null;
  /** The visitor count goes into PALMS, so it has to be in before locking. */
  visitorsEntered: boolean;
  /** Present + Late as PALMS stands. */
  inRoom: number;
  /** Members with no status yet. */
  blanks: number;
  pendingMedical: string[];
  unconfirmedSubs: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <LockIcon /> Finalize meeting
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalize this meeting?</DialogTitle>
            <DialogDescription>
              Everyone without a status becomes Absent (A), or Medical (M) if their medical leave is approved. PALMS then
              locks and can only be changed by reopening it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>{blanks} member(s) will be marked absent or medical.</p>
            {!visitorsEntered ? (
              <p className="rounded-md bg-amber-50 p-2 text-amber-900">
                The visitor count isn&apos;t in yet. It is part of PALMS, so the LVH team has to enter it on the
                Visitors page before this meeting can be locked — 0 is a valid answer.
              </p>
            ) : null}
            {headcount === null ? (
              <p className="rounded-md bg-amber-50 p-2 text-amber-900">
                No headcount was entered. Add it first so PALMS can be checked against the room.
              </p>
            ) : headcount !== inRoom ? (
              <p className="rounded-md bg-amber-50 p-2 text-amber-900">
                Headcount is {headcount}, but PALMS has {inRoom} (Present + Late). Check the sheet before finalizing.
              </p>
            ) : null}
            {pendingMedical.length ? (
              <p className="rounded-md bg-amber-50 p-2 text-amber-900">
                {pendingMedical.length} medical leave request(s) still pending, so they count as absent:{" "}
                {pendingMedical.join(", ")}.
              </p>
            ) : null}
            {unconfirmedSubs.length ? (
              <p className="rounded-md bg-amber-50 p-2 text-amber-900">
                Substitutes never confirmed as arrived (will be absent): {unconfirmedSubs.join(", ")}.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || !visitorsEntered}
              onClick={() =>
                start(async () => {
                  const res = await lvhFinalize({ meetingId, headcount });
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("Meeting finalized.");
                  setOpen(false);
                  router.push(`/meetings/${meetingId}/summary`);
                })
              }
            >
              Finalize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
