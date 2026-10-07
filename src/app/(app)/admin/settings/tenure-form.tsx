"use client";

import { PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { chooseTenure, createTenure, updateTenure } from "@/actions/tenure";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tenure } from "@/lib/tenure";

type Span = { month: string; year: string };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** A tenure runs in whole months, so it is picked as month + year at each end. */
export function TenureForm({ tenures, today, selected }: { tenures: Tenure[]; today: string; selected: string }) {
  const router = useRouter();
  const [from, setFrom] = useState({ month: "", year: "" });
  const [to, setTo] = useState({ month: "", year: "" });
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<Tenure | null>(null);
  const shown = tenures.find((t) => t.id === selected) ?? tenures[0];
  const thisYear = Number(today.slice(0, 4));
  const years = Array.from({ length: 7 }, (_, i) => String(thisYear - 1 + i));
  const ready = from.month && from.year && to.month && to.year;

  const save = () =>
    start(async () => {
      const res = await createTenure({
        startMonth: Number(from.month),
        startYear: Number(from.year),
        endMonth: Number(to.month),
        endYear: Number(to.year),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(
        res.data.copied
          ? `Tenure "${res.data.name}" created, with ${res.data.copied} role(s) carried over.`
          : `Tenure "${res.data.name}" created.`,
      );
      setFrom({ month: "", year: "" });
      setTo({ month: "", year: "" });
      router.refresh();
    });

  const picker = (label: string, value: Span, set: (v: Span) => void) => (
    <MonthYear label={label} value={value} onChange={set} years={years} />
  );

  return (
    <div className="space-y-3">
      {/* The same dropdown as the one in the header, so picking one here also
          changes the tenure the rest of the app is showing. */}
      {shown ? (
        <div className="space-y-1.5">
          <Label>Tenure</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={shown.id}
              disabled={pending}
              onValueChange={(id) =>
                start(async () => {
                  await chooseTenure(id);
                  router.refresh();
                })
              }
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tenures.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="default" disabled={pending} onClick={() => setEditing(shown)}>
              <PencilIcon /> Edit
            </Button>
            {/* Today decides which one is live — there is nothing to tick. */}
            {shown.startsOn <= today && today <= shown.endsOn ? <Badge>Current</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {shown.startsOn} to {shown.endsOn} · {tenures.length} tenure{tenures.length === 1 ? "" : "s"} in all
          </p>
        </div>
      ) : null}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          {picker("Starts", from, setFrom)}
          {picker("Ends", to, setTo)}
          <Button disabled={pending || !ready} onClick={save}>
            Create tenure
          </Button>
        </CardContent>
      </Card>
      {editing ? <EditTenure tenure={editing} years={years} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function MonthYear({
  label,
  value,
  onChange,
  years,
}: {
  label: string;
  value: Span;
  onChange: (v: Span) => void;
  years: string[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Select value={value.month} onValueChange={(month) => onChange({ ...value, month })}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={value.year} onValueChange={(year) => onChange({ ...value, year })}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** Changing a tenure's months: the name follows them, so there is nothing to type. */
function EditTenure({ tenure, years, onClose }: { tenure: Tenure; years: string[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [from, setFrom] = useState<Span>({
    month: String(Number(tenure.startsOn.slice(5, 7))),
    year: tenure.startsOn.slice(0, 4),
  });
  const [to, setTo] = useState<Span>({
    month: String(Number(tenure.endsOn.slice(5, 7))),
    year: tenure.endsOn.slice(0, 4),
  });
  const ready = from.month && from.year && to.month && to.year;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {tenure.name}</DialogTitle>
          <DialogDescription>
            Who holds which role stays with this tenure. What moves is the window its meetings, PALMS and events are
            read through.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-3">
          <MonthYear label="Starts" value={from} onChange={setFrom} years={years} />
          <MonthYear label="Ends" value={to} onChange={setTo} years={years} />
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !ready}
            onClick={() =>
              start(async () => {
                const res = await updateTenure(tenure.id, {
                  startMonth: Number(from.month),
                  startYear: Number(from.year),
                  endMonth: Number(to.month),
                  endYear: Number(to.year),
                });
                if (!res.ok) return void toast.error(res.error);
                toast.success(`Tenure saved as "${res.data.name}".`);
                onClose();
                router.refresh();
              })
            }
          >
            Save tenure
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
