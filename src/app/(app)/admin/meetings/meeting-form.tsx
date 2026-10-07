"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createMeeting, generateWeekly, updateMeeting } from "@/actions/meetings";
import { saveVenue } from "@/actions/venues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type VenueOption = { id: string; name: string };

export type MeetingFormValues = {
  title: string;
  /** "" until picked: a new meeting starts with nothing chosen for it. */
  kind: "" | "weekly" | "visitor_day" | "event" | "training" | "other";
  mode: "" | "in_person" | "online";
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  opensBeforeMin: string;
  closesAfterMin: string;
  weeks: string;
};

const KIND_LABELS = {
  weekly: "Weekly meeting",
  visitor_day: "Visitor day",
  event: "Event",
  training: "Training",
  other: "Other",
};

export function MeetingForm({
  mode: formMode,
  venues,
  initial,
  meetingId,
  onDone,
}: {
  mode: "single" | "weekly" | "edit";
  venues: VenueOption[];
  initial: MeetingFormValues;
  meetingId?: string;
  /** Closes the dialog this form is shown in, once something was created. */
  onDone?: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const set = <K extends keyof MeetingFormValues>(k: K, value: MeetingFormValues[K]) => setV((s) => ({ ...s, [k]: value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const common = {
        title: v.title,
        date: v.date,
        startTime: v.startTime,
        endTime: v.endTime,
        opensBeforeMin: v.opensBeforeMin,
        closesAfterMin: v.closesAfterMin,
        venueId: v.venueId,
      };
      if (formMode === "weekly") {
        const res = await generateWeekly({ ...common, weeks: v.weeks });
        if (!res.ok) return void toast.error(res.error);
        toast.success(
          res.data.skipped
            ? `${res.data.count} created; ${res.data.skipped} week(s) already had a meeting and were skipped.`
            : `${res.data.count} weekly meetings created.`,
        );
        // Every box goes back to empty, so nothing is created from leftovers.
        setV(initial);
        onDone?.();
        router.refresh();
        return;
      }
      // Nothing is pre-picked, so both have to be chosen before this can be saved.
      if (!v.kind || !v.mode) return void toast.error("Choose the type, and whether it is in person or online.");
      const payload = { ...common, kind: v.kind, mode: v.mode };
      const res = formMode === "edit" ? await updateMeeting(meetingId!, payload) : await createMeeting(payload);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Saved.");
      if (formMode === "single") {
        setV(initial);
        onDone?.();
      }
      router.push("/admin/meetings");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <Input value={v.title} onChange={(e) => set("title", e.target.value)} required />
        </Field>
        {formMode !== "weekly" ? (
          <Field label="Type">
            <Select value={v.kind} onValueChange={(x) => set("kind", x as MeetingFormValues["kind"])}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        {formMode !== "weekly" ? (
          <Field label="Where">
            <Select value={v.mode} onValueChange={(x) => set("mode", x as MeetingFormValues["mode"])}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="In person or online" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">In person</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        {v.mode === "in_person" || formMode === "weekly" ? (
          <Field label="Venue">
            <VenueField venues={venues} value={v.venueId} onChange={(id) => set("venueId", id)} />
          </Field>
        ) : null}
        <Field label={formMode === "weekly" ? "First meeting date" : "Date"}>
          <Input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <Input type="time" value={v.startTime} onChange={(e) => set("startTime", e.target.value)} required />
          </Field>
          <Field label="Ends">
            <Input type="time" value={v.endTime} onChange={(e) => set("endTime", e.target.value)} required />
          </Field>
        </div>
        {formMode === "weekly" ? (
          <Field label="Number of weeks">
            <Input inputMode="numeric" value={v.weeks} onChange={(e) => set("weeks", e.target.value.replace(/\D/g, ""))} />
          </Field>
        ) : null}
        <Field label="Check-in opens (minutes before start)">
          <Input
            inputMode="numeric"
            value={v.opensBeforeMin}
            onChange={(e) => set("opensBeforeMin", e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field
          label="Check-in closes (minutes after start)"
          hint="A member can check in, or give a reason for missing it, until then. Empty: check-in runs to the end of the meeting, and reasons close when it starts."
        >
          <Input
            inputMode="numeric"
            placeholder="e.g. 15"
            value={v.closesAfterMin}
            onChange={(e) => set("closesAfterMin", e.target.value.replace(/\D/g, ""))}
          />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {formMode === "weekly" ? "Create weekly meetings" : formMode === "edit" ? "Save changes" : "Create meeting"}
      </Button>
    </form>
  );
}

/**
 * Pick a venue, or add one without leaving the meeting you're scheduling — a
 * new hall is nearly always typed while filling this form.
 */
function VenueField({
  venues,
  value,
  onChange,
}: {
  venues: VenueOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [pending, start] = useTransition();
  // Venues added here, until the server sends them back in `venues`.
  const [added, setAdded] = useState<VenueOption[]>([]);
  const options = [...venues, ...added.filter((a) => !venues.some((x) => x.id === a.id))];

  function add() {
    start(async () => {
      const res = await saveVenue(null, { name, address });
      if (!res.ok) return void toast.error(res.error);
      setAdded((s) => [...s, { id: res.data.id, name: name.trim() }]);
      onChange(res.data.id);
      setAdding(false);
      setName("");
      setAddress("");
      toast.success("Venue added.");
    });
  }

  if (!adding) {
    return (
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a venue" />
          </SelectTrigger>
          <SelectContent>
            {options.map((x) => (
              <SelectItem key={x.id} value={x.id}>
                {x.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="icon" aria-label="Add a venue" title="Add a venue" onClick={() => setAdding(true)}>
          <PlusIcon />
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Input autoFocus placeholder="Hotel / hall name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="Address shown to members" value={address} onChange={(e) => setAddress(e.target.value)} />
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={pending || name.trim().length < 2} onClick={add}>
          Add venue
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setAdding(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
