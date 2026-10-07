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
  path,
  param = "m",
  params,
  allLabel,
  className,
}: {
  /** The month being shown, or "" when the list isn't narrowed. */
  value: string;
  months: { key: string; label: string }[];
  /** Where the list lives, e.g. "/admin/calendar". */
  path: string;
  /** The query key the page reads the month from. */
  param?: string;
  /**
   * Other query values to keep, e.g. the tab or a kind filter. Pagination is
   * deliberately not among them: a narrowed list starts at page one.
   */
  params?: Record<string, string | undefined>;
  /** Given, the list can be widened back to every month. */
  allLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const options = allLabel ? [{ key: ALL, label: allLabel }, ...months] : months;
  // One month to choose from is not a choice.
  if (options.length < 2) return null;
  // Built here rather than passed in: a function can't cross from a Server
  // Component to this one.
  const hrefFor = (month: string) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v) qs.set(k, v);
    if (month) qs.set(param, month);
    const s = qs.toString();
    return s ? `${path}?${s}` : path;
  };
  return (
    <Select value={value || ALL} onValueChange={(key) => router.push(hrefFor(key === ALL ? "" : key))}>
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
