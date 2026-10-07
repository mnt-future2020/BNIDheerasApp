"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setHeadcount } from "@/actions/lvh";
import { savePalms } from "@/actions/palms";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/attendance/rules";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/time";

type Row = {
  id: string;
  name: string;
  category: string | null;
  status: AttendanceStatus | "";
  method: string | null;
  at: string | null;
  substitute: string | null;
  leave: "medical" | "informed" | null;
};

/** One tap per member: P, A, L, M or S for the whole chapter, then Save. */
export function PalmsSheet({
  meetingId,
  members,
  hasRecords,
  headcount,
}: {
  meetingId: string;
  members: Row[];
  hasRecords: boolean;
  /** Counted in the room; PALMS should add up to it. */
  headcount: number | null;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Record<string, AttendanceStatus | "">>(
    Object.fromEntries(members.map((m) => [m.id, m.status])),
  );
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);
  const [countText, setCountText] = useState(headcount === null ? "" : String(headcount));
  const [pending, start] = useTransition();

  const changed = members.filter((m) => picked[m.id] !== m.status).length;
  const tally = (s: AttendanceStatus) => members.filter((m) => picked[m.id] === s).length;
  // Everyone PALMS says attended, as the sheet stands right now.
  const inRoom = tally("P") + tally("L");
  const setAll = (status: AttendanceStatus | "") => setPicked(Object.fromEntries(members.map((m) => [m.id, status])));
  // The usual order of work: mark the absent, late and medical, then everyone
  // left over was present. Only blank rows are filled, so nothing is undone.
  const blanks = members.filter((m) => !picked[m.id]).length;
  const fillRestPresent = () =>
    setPicked((p) => Object.fromEntries(members.map((m) => [m.id, p[m.id] || "P"])));

  // Saving asks for the headcount first: the room count is only trustworthy
  // next to the statuses that were just entered, and it is what checks them.
  const save = () =>
    start(async () => {
      const head = await setHeadcount({ meetingId, count: Number(countText) });
      if (!head.ok) return void toast.error(head.error);
      const res = await savePalms({
        meetingId,
        reason,
        rows: members.map((m) => ({ memberId: m.id, status: picked[m.id] })),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data.changed === 0 ? "Nothing to save." : `Saved. ${res.data.changed} member(s) updated.`, {
        // Straight on to the report the Secretary posts after the meeting.
        action: { label: "Report", onClick: () => router.push(`/meetings/${meetingId}/summary`) },
      });
      setReason("");
      setAsking(false);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Quick fill:</span>
        <Button type="button" variant="outline" size="sm" onClick={() => setAll("P")}>
          Everyone present
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={blanks === 0} onClick={fillRestPresent}>
          Rest present ({blanks})
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setAll("")}>
          Clear all
        </Button>
        <span className="ml-auto tabular-nums text-muted-foreground">
          {ATTENDANCE_STATUSES.map((s) => `${s} ${tally(s)}`).join(" · ")}
        </span>
      </div>

      {headcount !== null && headcount !== inRoom ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Headcount is {headcount}, but PALMS has {inRoom} (Present + Late). {Math.abs(headcount - inRoom)}{" "}
          {headcount > inRoom ? "member(s) in the room are not marked in" : "more marked in than were counted"} — fix one
          of the two before finalizing.
        </p>
      ) : null}

      <div className="divide-y rounded-xl border bg-card">
        {members.map((m, i) => (
          <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
            <span className="w-5 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{m.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {[
                  m.category,
                  m.substitute ? `Substitute: ${m.substitute}` : null,
                  m.leave === "medical" ? "Medical leave approved" : m.leave === "informed" ? "Informed absence" : null,
                  m.method === "self_qr" && m.at ? `Checked in ${formatTime(new Date(m.at))}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <div className="flex gap-1">
              {ATTENDANCE_STATUSES.map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="icon-sm"
                  variant={picked[m.id] === s ? "default" : "outline"}
                  aria-label={`${m.name}: ${STATUS_LABELS[s]}`}
                  aria-pressed={picked[m.id] === s}
                  onClick={() => setPicked((p) => ({ ...p, [m.id]: p[m.id] === s ? "" : s }))}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ))}
        {members.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">No members yet.</p> : null}
      </div>

      <div className={cn("sticky bottom-20 z-10 space-y-2 rounded-xl border bg-card p-3 shadow-lg lg:bottom-4")}>
        {hasRecords ? (
          <div className="space-y-1.5">
            <Label htmlFor="palms-reason">Reason for the change</Label>
            <Input
              id="palms-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. entered from the paper sheet"
            />
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {changed === 0 ? "No changes yet" : `${changed} member(s) changed`}
          </span>
          <Button
            className="ml-auto"
            // The reason is checked before the headcount dialog opens: saving the
            // headcount and then failing on the reason would leave the two apart.
            disabled={pending || changed === 0 || (hasRecords && reason.trim().length < 3)}
            onClick={() => {
              setCountText(headcount === null ? "" : String(headcount));
              setAsking(true);
            }}
          >
            Save PALMS
          </Button>
        </div>
      </div>

      <Dialog open={asking} onOpenChange={(o) => !o && setAsking(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How many were in the room?</DialogTitle>
            <DialogDescription>
              The headcount is saved with the PALMS and checks it. Count the members you saw, not the visitors.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="palms-headcount">Members in the room</Label>
            <Input
              id="palms-headcount"
              autoFocus
              inputMode="numeric"
              placeholder="e.g. 55"
              value={countText}
              onChange={(e) => setCountText(e.target.value.replace(/\D/g, "").slice(0, 3))}
            />
            <p className={countText !== "" && Number(countText) !== inRoom ? "text-xs text-amber-700" : "text-xs text-muted-foreground"}>
              {countText !== "" && Number(countText) !== inRoom
                ? `This sheet has ${inRoom} (Present + Late) — ${Math.abs(Number(countText) - inRoom)} apart. Save anyway and fix it later, or go back and correct the sheet.`
                : `This sheet has ${inRoom} (Present + Late).`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setAsking(false)}>
              Back to the sheet
            </Button>
            <Button disabled={pending || countText === ""} onClick={save}>
              Save PALMS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
