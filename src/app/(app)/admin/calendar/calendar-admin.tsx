"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteCalendarEvent, saveCalendarEvent } from "@/actions/calendar";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/** A built-in key, or a type the chapter named itself. */
type Kind = string;
type EventRow = {
  id: string;
  kind: Kind;
  title: string;
  description: string;
  date: string;
  location: string;
  memberId: string;
};

const NONE = "__none";

export function CalendarAdmin({
  kinds,
  labels,
  members,
  events,
}: {
  /** The types that can be chosen for a new event. */
  kinds: { key: Kind; label: string }[];
  /** Names for every type in use, including retired ones on older events. */
  labels: Record<string, string>;
  members: { id: string; name: string }[];
  events: EventRow[];
}) {
  const [editing, setEditing] = useState<EventRow | null>(null);
  // Nothing filled in ahead of time: every field is typed for the event at hand.
  const blank: EventRow = {
    id: "",
    kind: kinds[0].key,
    title: "",
    description: "",
    date: "",
    location: "",
    memberId: "",
  };
  const labelOf = (k: Kind) => labels[k] ?? kinds.find((x) => x.key === k)?.label ?? k;

  return (
    <div className="space-y-4">
      {/* The form takes the page over: the list underneath it only distracts. */}
      {editing ? (
        <EventForm
          key={editing.id || "new"}
          row={editing}
          kinds={kinds}
          labels={labels}
          members={members}
          onDone={() => setEditing(null)}
        />
      ) : (
        <>
          <Button onClick={() => setEditing(blank)}>
            <PlusIcon /> Create event
          </Button>
          <div className="divide-y rounded-xl border bg-card">
            {events.map((e) => {
              const presenter = e.memberId ? (members.find((m) => m.id === e.memberId)?.name ?? "") : "";
              return (
                // Icons, not words, for Edit and Delete: on a phone the labels
                // squeezed the title down to one word a line.
                <div key={e.id} className="flex items-center gap-1 py-2 pr-2 pl-4 first:rounded-t-xl last:rounded-b-xl">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      <Badge variant="secondary" className="font-normal">
                        {labelOf(e.kind)}
                      </Badge>
                      <span>{shortDate(e.date)}</span>
                      {presenter ? <span className="truncate">· {presenter}</span> : null}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${e.title}`}
                    title="Edit"
                    onClick={() => setEditing(e)}
                  >
                    <PencilIcon />
                  </Button>
                  <ConfirmButton
                    label="Delete"
                    ariaLabel={`Delete ${e.title}`}
                    icon={<Trash2Icon />}
                    iconOnly
                    size="icon-sm"
                    title={`Delete "${e.title}"?`}
                    description="It disappears from everyone's calendar."
                    success="Deleted."
                    action={() => deleteCalendarEvent(e.id)}
                  />
                </div>
              );
            })}
            {events.length === 0 ? <div className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing yet.</div> : null}
          </div>
        </>
      )}
    </div>
  );
}

function EventForm({
  row,
  kinds,
  labels,
  members,
  onDone,
}: {
  row: EventRow;
  kinds: { key: Kind; label: string }[];
  labels: Record<string, string>;
  members: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [v, setV] = useState(row);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState("");
  // Types named here, until an item using them comes back from the server.
  const [extra, setExtra] = useState<string[]>([]);
  const set = <K extends keyof EventRow>(k: K, value: EventRow[K]) => setV((s) => ({ ...s, [k]: value }));
  const isSlot = v.kind === "feature_presentation" || v.kind === "education_slot";
  // The event's own type is always listed, even a retired one, so opening an
  // old event to fix its date can't quietly change what kind of event it is.
  const options = [
    ...kinds,
    ...[...new Set([...extra, row.kind])]
      .filter((e) => e && !kinds.some((k) => k.key === e))
      .map((key) => ({ key, label: labels[key] ?? key })),
  ];

  return (
    <Card>
      <CardContent className="py-4">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            // The date picker is a button, so the browser can't hold an empty one back.
            if (!v.date) return void toast.error("Pick a date.");
            start(async () => {
              const { id, ...input } = v;
              const res = await saveCalendarEvent(id || null, input);
              if (!res.ok) return void toast.error(res.error);
              toast.success("Saved.");
              onDone();
            });
          }}
        >
          <div className="space-y-1.5">
            <Label>Type</Label>
            {adding ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="New type, e.g. Chapter visit"
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={newKind.trim().length < 2}
                  onClick={() => {
                    // Stored as typed: a type exists because an item uses it.
                    const name = newKind.trim();
                    setExtra((list) => [...list, name]);
                    set("kind", name);
                    setNewKind("");
                    setAdding(false);
                  }}
                >
                  Add
                </Button>
                <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={v.kind} onValueChange={(x) => set("kind", x)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((k) => (
                      <SelectItem key={k.key} value={k.key}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" aria-label="Add a type" onClick={() => setAdding(true)}>
                  <PlusIcon />
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Title</Label>
            <Input id="ev-title" value={v.title} onChange={(e) => set("title", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{isSlot ? "Presenter" : "Member (optional)"}</Label>
            <Select value={v.memberId || NONE} onValueChange={(x) => set("memberId", x === NONE ? "" : x)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Nobody" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nobody</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-date">Date</Label>
            <DatePicker id="ev-date" value={v.date} onChange={(x) => set("date", x)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-loc">Location</Label>
            <Input id="ev-loc" value={v.location} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ev-desc">Details</Label>
            <Textarea id="ev-desc" value={v.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              Save
            </Button>
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** "2026-10-14" → "Wed, 14 Oct 2026" (the date is already in IST). */
function shortDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}
