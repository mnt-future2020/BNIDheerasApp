"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Narrows the meeting list to one month. */
export function MonthFilter({ month, months }: { month: string; months: { key: string; label: string }[] }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <Label>Month</Label>
      <Select value={month} onValueChange={(key) => router.push(`/admin/awards?month=${key}`)}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Choose a month" />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m.key} value={m.key}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
