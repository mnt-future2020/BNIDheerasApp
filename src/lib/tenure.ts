import "server-only";
import { desc, lte, gte, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { term } from "@/db/schema";
import { istToDate, toIstDateInput } from "@/lib/time";

export const TENURE_COOKIE = "tenure";

export type Tenure = { id: string; name: string; startsOn: string; endsOn: string };

/** Every tenure the chapter has had, newest first. */
export function listTenures(): Promise<Tenure[]> {
  return db
    .select({ id: term.id, name: term.name, startsOn: term.startsOn, endsOn: term.endsOn })
    .from(term)
    .orderBy(desc(term.startsOn));
}

/** The tenure today falls in, which is what the app opens on. */
export async function currentTenure(now = new Date()): Promise<Tenure | null> {
  const today = toIstDateInput(now);
  const [row] = await db
    .select({ id: term.id, name: term.name, startsOn: term.startsOn, endsOn: term.endsOn })
    .from(term)
    .where(and(lte(term.startsOn, today), gte(term.endsOn, today)))
    .limit(1);
  return row ?? null;
}

/**
 * The tenure being looked at: the one picked in the header, else the one today
 * falls in, else the most recent. Only what is shown follows it — a member's
 * roles and permissions always come from today's tenure, so switching the view
 * can never hand anyone access they don't have.
 */
export async function selectedTenure(): Promise<Tenure | null> {
  const [all, picked] = await Promise.all([listTenures(), cookies().then((c) => c.get(TENURE_COOKIE)?.value)]);
  if (all.length === 0) return null;
  return all.find((t) => t.id === picked) ?? (await currentTenure()) ?? all[0];
}

/** The window a tenure covers, as instants, for filtering by date. */
export function tenureRange(t: Tenure): { from: Date; to: Date } {
  // endsOn is the last day, so the window runs to the start of the day after.
  const after = new Date(`${t.endsOn}T00:00:00Z`);
  after.setUTCDate(after.getUTCDate() + 1);
  return { from: istToDate(t.startsOn, "00:00"), to: istToDate(toIstDateInput(after), "00:00") };
}
