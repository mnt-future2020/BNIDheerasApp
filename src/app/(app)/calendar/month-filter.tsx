"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** The month to show. A dropdown, so a year of months doesn't need scrolling. */
export function MonthFilter({ month, months }: { month: string; months: { key: string; label: string; href: string }[] }) {
  const router = useRouter();
  return (
    <Select
      value={month}
      onValueChange={(key) => {
        const next = months.find((m) => m.key === key);
        if (next) router.push(next.href);
      }}
    >
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {months.map((m) => (
          <SelectItem key={m.key} value={m.key}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
