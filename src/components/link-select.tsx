"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type LinkOption = { key: string; label: string; href: string };

/**
 * A filter that navigates. The page reads it off the URL, so picking one is a
 * link rather than client state — and the href is built on the server, because
 * a function can't be passed into a Client Component.
 */
export function LinkSelect({
  value,
  options,
  label,
  className,
}: {
  value: string;
  options: LinkOption[];
  label: string;
  className?: string;
}) {
  const router = useRouter();
  if (options.length < 2) return null;
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
