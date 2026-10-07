"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createTenure } from "@/actions/tenure";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tenure } from "@/lib/tenure";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** A tenure runs in whole months, so it is picked as month + year at each end. */
export function TenureForm({ tenures, today }: { tenures: Tenure[]; today: string }) {
  const router = useRouter();
  const [from, setFrom] = useState({ month: "", year: "" });
  const [to, setTo] = useState({ month: "", year: "" });
  const [pending, start] = useTransition();
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

  const picker = (
    label: string,
    value: { month: string; year: string },
    set: (v: { month: string; year: string }) => void,
  ) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Select value={value.month} onValueChange={(m) => set({ ...value, month: m })}>
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
        <Select value={value.year} onValueChange={(y) => set({ ...value, year: y })}>
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

  return (
    <div className="space-y-3">
      {tenures.length ? (
        <div className="divide-y rounded-xl border bg-card">
          {tenures.map((t) => (
            <div key={t.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
              <span className="flex-1">
                <span className="font-medium">{t.name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {t.startsOn} to {t.endsOn}
                </span>
              </span>
              {/* Today decides which one is live — there is nothing to tick. */}
              {t.startsOn <= today && today <= t.endsOn ? <Badge>Current</Badge> : null}
            </div>
          ))}
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
    </div>
  );
}
