"use client";

import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteCalendarEvent, saveCalendarEvent } from "@/actions/calendar";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  members,
  events,
}: {
  kinds: { key: Kind; label: string }[];
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
  const labelOf = (k: Kind) => kinds.find((x) => x.key === k)?.label ?? k;

  return (
    <div className="space-y-4">
      {/* The form takes the page over: the list underneath it only distracts. */}
      {editing ? (
        <EventForm key={editing.id || "new"} row={editing} kinds={kinds} members={members} onDone={() => setEditing(null)} />
      ) : (
        <>
          <Button onClick={() => setEditing(blank)}>
            <PlusIcon /> Add to calendar
          </Button>
          <div className="divide-y rounded-xl border">
            {events.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {shortDate(e.date)}
                    {e.memberId ? ` · ${members.find((m) => m.id === e.memberId)?.name ?? ""}` : ""}
                  </div>
                </div>
                <Badge variant="secondary">{labelOf(e.kind)}</Badge>
                <Button variant="ghost" size="sm" onClick={() => setEditing(e)}>
                  Edit
                </Button>
                <ConfirmButton
                  label="Delete"
                  title={`Delete "${e.title}"?`}
                  description="It disappears from everyone's calendar."
                  success="Deleted."
                  action={() => deleteCalendarEvent(e.id)}
                />
              </div>
            ))}
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
  members,
  onDone,
}: {
  row: EventRow;
  kinds: { key: Kind; label: string }[];
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
  const options = [...kinds, ...extra.filter((e) => !kinds.some((k) => k.key === e)).map((key) => ({ key, label: key }))];

  return (
    <Card>
      <CardContent className="py-4">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
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
            <Input id="ev-date" type="date" value={v.date} onChange={(e) => set("date", e.target.value)} required />
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
