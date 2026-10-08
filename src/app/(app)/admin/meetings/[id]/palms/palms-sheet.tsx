"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { recordAbsence } from "@/actions/leave";
import { setHeadcount } from "@/actions/lvh";
import { savePalms } from "@/actions/palms";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  substitutePhone: string | null;
  leave: "medical" | "informed" | null;
  leaveReason: string | null;
};

/**
 * What a member already told us, as a letter. Every way of saying "I can't
 * attend" lands here: a substitute is S, medical leave is M, and simply letting
 * the chapter know is A. A substitute wins over a leave, because somebody is
 * in the seat — if they never turned up, the letter is changed on the sheet.
 */
const fromPlan = (m: Row): AttendanceStatus | "" =>
  m.substitute ? "S" : m.leave === "medical" ? "M" : m.leave === "informed" ? "A" : "";

/**
 * The letter a row starts on: what PALMS already records, else what the member
 * told the chapter themselves. This is the mark "changed" is counted against —
 * a substitute the member entered is not a change somebody made on this sheet.
 */
const seeded = (m: Row): AttendanceStatus | "" => m.status || fromPlan(m);

/**
 * Two colours, because the sheet is read at a glance: green is everyone who was
 * in the room, blue is everyone who was not. Only the chosen letter is filled.
 */
const PICKED_COLOR: Record<AttendanceStatus, string> = {
  P: "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/90",
  L: "border-transparent bg-emerald-600 text-white hover:bg-emerald-600/90",
  A: "border-transparent bg-sky-600 text-white hover:bg-sky-600/90",
  M: "border-transparent bg-sky-600 text-white hover:bg-sky-600/90",
  S: "border-transparent bg-sky-600 text-white hover:bg-sky-600/90",
};

/** The three letters that mean "not in the room", which carry a reason. */
const AWAY: AttendanceStatus[] = ["A", "M", "S"];

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
  // Anyone who said they can't come is already marked, so the sheet starts
  // where the chapter left it — S, M or A. It is only a starting point:
  // tapping another letter wins, and nothing is saved until Save.
  const [picked, setPicked] = useState<Record<string, AttendanceStatus | "">>(
    Object.fromEntries(members.map((m) => [m.id, seeded(m)])),
  );
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);
  const [countText, setCountText] = useState(headcount === null ? "" : String(headcount));
  const [away, setAway] = useState<{ row: Row; status: AttendanceStatus } | null>(null);
  const [pending, start] = useTransition();

  // Against where the row started, not against what PALMS holds: otherwise a
  // sheet opens already claiming changes nobody made. Re-read from the props
  // each render, so a save settles the count back to nothing.
  const changed = members.filter((m) => picked[m.id] !== seeded(m)).length;
  const tally = (s: AttendanceStatus) => members.filter((m) => picked[m.id] === s).length;
  // Everyone PALMS says attended, as the sheet stands right now.
  const inRoom = tally("P") + tally("L");

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
      {/* Every letter is a deliberate tap, one member at a time — nothing fills
          the sheet in on the Head Table's behalf. The running tally is all this
          row carries. */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
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
                  m.leave === "medical" ? "Medical leave" : m.leave === "informed" ? "Informed absence" : null,
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
                  variant="outline"
                  className={cn(picked[m.id] === s && PICKED_COLOR[s])}
                  aria-label={`${m.name}: ${STATUS_LABELS[s]}`}
                  aria-pressed={picked[m.id] === s}
                  // Away means there is a reason to read, so the letter opens it
                  // rather than being set behind the Head Table's back.
                  onClick={() =>
                    AWAY.includes(s)
                      ? setAway({ row: m, status: s })
                      : setPicked((p) => ({ ...p, [m.id]: p[m.id] === s ? "" : s }))
                  }
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

      {away ? (
        <AwayDialog
          meetingId={meetingId}
          row={away.row}
          status={away.status}
          current={picked[away.row.id] ?? ""}
          onClose={() => setAway(null)}
          onPick={(status) => {
            setPicked((p) => ({ ...p, [away.row.id]: p[away.row.id] === status ? "" : status }));
            setAway(null);
          }}
        />
      ) : null}
    </div>
  );
}

const AWAY_TITLE: Record<string, string> = { A: "Absent", M: "Medical leave", S: "Substitute" };

/**
 * A, M and S all mean the member wasn't in their seat, and each has something
 * behind it — what they told the Head Table, or who came instead. The letter
 * opens that rather than setting itself, so nobody is marked absent without the
 * reason in front of them, and a reason can be written here.
 */
function AwayDialog({
  meetingId,
  row,
  status,
  current,
  onPick,
  onClose,
}: {
  meetingId: string;
  row: Row;
  status: AttendanceStatus;
  /** What the sheet shows for this member right now, saved or not. */
  current: AttendanceStatus | "";
  onPick: (status: AttendanceStatus) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState(row.leaveReason ?? "");
  const [pending, start] = useTransition();
  const isSub = status === "S";
  const already = current === status;

  const saveReason = () =>
    start(async () => {
      const res = await recordAbsence({
        meetingId,
        memberId: row.id,
        kind: status === "M" ? "medical" : "informed",
        reason: text,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Reason saved.");
      router.refresh();
      onPick(status);
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {row.name} · {AWAY_TITLE[status]}
          </DialogTitle>
          <DialogDescription>
            {isSub
              ? "Who came in their place."
              : "What they told the Head Table, or what the member said from their phone."}
          </DialogDescription>
        </DialogHeader>

        {isSub ? (
          <p className="rounded-lg bg-muted p-3 text-sm">
            {row.substitute ? (
              <>
                <b>{row.substitute}</b>
                {row.substitutePhone ? ` · ${row.substitutePhone}` : ""}
              </>
            ) : (
              <span className="text-muted-foreground">
                No substitute registered. The member can send one from their phone until the meeting ends.
              </span>
            )}
          </p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="away-reason">Reason</Label>
            <Textarea
              id="away-reason"
              rows={3}
              value={text}
              placeholder="e.g. out of town for a wedding"
              onChange={(e) => setText(e.target.value)}
            />
            {row.leaveReason ? (
              <p className="text-xs text-muted-foreground">
                {"On record"}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Nothing on record yet.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          {/* Marking and writing the reason are one tap when there is a reason. */}
          {isSub || text.trim().length < 2 ? (
            <Button disabled={pending} onClick={() => onPick(status)}>
              {already ? `Clear ${status}` : `Mark ${status}`}
            </Button>
          ) : (
            <Button disabled={pending} onClick={saveReason}>
              Save reason and mark {status}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
