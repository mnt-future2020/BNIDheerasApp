"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Radix Select has no empty value, so "every month" needs a name of its own. */
const ALL = "__all";

/**
 * The one month picker, used by every dated list — Events, Meetings, PALMS,
 * Recognitions, Celebrations, Feedback, Leave and the Audit log — so narrowing
 * a list is the same gesture everywhere. The page reads the month off the URL,
 * so picking one is a navigation, not client state.
 */
export function MonthFilter({
  value,
  months,
  href,
  allLabel,
  className,
}: {
  /** The month being shown, or "" when the list isn't narrowed. */
  value: string;
  months: { key: string; label: string }[];
  href: (month: string) => string;
  /** Given, the list can be widened back to every month. */
  allLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const options = allLabel ? [{ key: ALL, label: allLabel }, ...months] : months;
  // One month to choose from is not a choice.
  if (options.length < 2) return null;
  return (
    <Select value={value || ALL} onValueChange={(key) => router.push(href(key === ALL ? "" : key))}>
      <SelectTrigger aria-label="Month" className={cn("w-full min-w-40 flex-1 sm:max-w-52", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((m) => (
          <SelectItem key={m.key} value={m.key}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
