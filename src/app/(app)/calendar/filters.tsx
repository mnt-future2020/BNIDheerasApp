"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FilterOption = { key: string; label: string; href: string };

/**
 * A filter that navigates. Month and kind both work this way: the page reads
 * them off the URL, so picking one is a link, not client state.
 */
export function LinkSelect({
  value,
  options,
  label,
  className,
}: {
  value: string;
  options: FilterOption[];
  label: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <Select
      value={value}
      onValueChange={(key) => {
        const next = options.find((o) => o.key === key);
        if (next) router.push(next.href);
      }}
    >
      <SelectTrigger aria-label={label} className={cn("w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.key} value={o.key}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
