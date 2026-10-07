import { formatMonth, istToDate, toIstDateInput } from "@/lib/time";
import type { Tenure } from "@/lib/tenure";

/**
 * Months as `yyyy-mm`. Every dated list in the app is narrowed the same way —
 * one dropdown of months — so the maths for it lives in one place.
 */
export type MonthKey = string;

/** The month a moment falls in, read in IST like every other date in the app. */
export function monthOf(date: Date): MonthKey {
  return toIstDateInput(date).slice(0, 7);
}

/** Every month from one key to another, inclusive and in order. */
export function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const list: MonthKey[] = [];
  for (let i = 0; fy * 12 + fm + i <= ty * 12 + tm; i++) {
    const d = new Date(Date.UTC(fy, fm - 1 + i, 1));
    list.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return list;
}

/** The months a tenure runs through — what the month dropdown offers. */
export function tenureMonthKeys(t: Tenure): MonthKey[] {
  return monthsBetween(t.startsOn.slice(0, 7), t.endsOn.slice(0, 7));
}

/** "October 2026", for the dropdown. */
export function monthLabel(key: MonthKey): string {
  return formatMonth(istToDate(`${key}-01`));
}

/** The instants a month covers: its first day, to the first day of the next. */
export function monthWindow(key: MonthKey): { from: Date; to: Date } {
  const [y, m] = key.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: istToDate(`${key}-01`), to: istToDate(`${next}-01`) };
}

/** The ready-made options for MonthFilter. */
export function monthOptions(keys: MonthKey[]): { key: MonthKey; label: string }[] {
  return keys.map((key) => ({ key, label: monthLabel(key) }));
}
