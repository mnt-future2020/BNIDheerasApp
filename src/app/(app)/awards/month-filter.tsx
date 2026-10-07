"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const ALL = "";

/** Narrows the list of weeks to one month; "All" is the way back to everything. */
export function MonthFilter({ month, months }: { month: string; months: { key: string; label: string }[] }) {
  const router = useRouter();
  if (months.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {[{ key: ALL, label: "All" }, ...months].map((m) => (
        <Button
          key={m.key || "all"}
          size="sm"
          variant={month === m.key ? "default" : "outline"}
          onClick={() => router.push(m.key ? `/awards?month=${m.key}` : "/awards")}
        >
          {m.label}
        </Button>
      ))}
    </div>
  );
}
