"use server";

import { and, desc, eq, gte, lte, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { roleAssignment, term } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { assertCap, assertMember } from "@/lib/session";
import { TENURE_COOKIE } from "@/lib/tenure";

const YEAR = 365 * 24 * 3600;
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const tenureSchema = z
  .object({
    startMonth: z.number().int().min(1).max(12),
    startYear: z.number().int().min(2000).max(2100),
    endMonth: z.number().int().min(1).max(12),
    endYear: z.number().int().min(2000).max(2100),
  })
  .refine((v) => v.endYear * 12 + v.endMonth >= v.startYear * 12 + v.startMonth, {
    message: "The tenure has to end in the same month or later than it starts.",
  });

const pad = (n: number) => String(n).padStart(2, "0");
/** The last day of a month, without stepping outside IST. */
const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Tenures run in whole months: Apr 2027 – Sep 2027, 1 April to 30 September. */
export async function createTenure(input: z.input<typeof tenureSchema>): Promise<ActionResult<{ id: string; name: string; copied: number }>> {
  return runAction(async () => {
    const me = await assertCap("roles.manage");
    const d = tenureSchema.parse(input);
    const startsOn = `${d.startYear}-${pad(d.startMonth)}-01`;
    const endsOn = `${d.endYear}-${pad(d.endMonth)}-${pad(lastDay(d.endYear, d.endMonth))}`;
    const name =
      d.startYear === d.endYear
        ? `${MONTH_NAMES[d.startMonth - 1]} – ${MONTH_NAMES[d.endMonth - 1]} ${d.endYear}`
        : `${MONTH_NAMES[d.startMonth - 1]} ${d.startYear} – ${MONTH_NAMES[d.endMonth - 1]} ${d.endYear}`;

    // Tenures can't overlap, or a meeting would belong to two of them.
    const [clash] = await db
      .select({ name: term.name })
      .from(term)
      .where(and(lte(term.startsOn, endsOn), gte(term.endsOn, startsOn), ne(term.id, "")))
      .limit(1);
    if (clash) throw new UserError(`Those months overlap the "${clash.name}" tenure.`);

    const [row] = await db.insert(term).values({ name, startsOn, endsOn }).returning({ id: term.id });

    // Roles are held per tenure, so a new one would start with nobody holding
    // anything — the Head Table would lose their access the day it begins.
    // The previous tenure's holders carry over; they can be changed after.
    const [previous] = await db
      .select({ id: term.id })
      .from(term)
      .where(lte(term.startsOn, startsOn))
      .orderBy(desc(term.startsOn))
      .limit(2)
      .offset(1);
    let copied = 0;
    if (previous) {
      const held = await db
        .select({ role: roleAssignment.role, memberId: roleAssignment.memberId })
        .from(roleAssignment)
        .where(eq(roleAssignment.termId, previous.id));
      if (held.length) {
        await db.insert(roleAssignment).values(held.map((h) => ({ ...h, termId: row.id }))).onConflictDoNothing();
        copied = held.length;
      }
    }
    await audit({
      actorId: me.id,
      action: "term.create",
      entity: "term",
      entityId: row.id,
      after: { name, startsOn, endsOn, rolesCopied: copied },
    });
    refresh();
    return { id: row.id, name, copied };
  });
}

/**
 * Remembers which tenure the member is looking at. It only changes what is
 * listed — never what they're allowed to do — so it's a plain cookie.
 */
export async function chooseTenure(id: string): Promise<void> {
  await assertMember();
  const jar = await cookies();
  jar.set(TENURE_COOKIE, z.uuid().parse(id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: YEAR });
  refresh();
}
