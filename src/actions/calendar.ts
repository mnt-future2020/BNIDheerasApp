"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { calendarEvent } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { assertCap } from "@/lib/session";
import { istToDate } from "@/lib/time";

const eventSchema = z.object({
  // Free text: the built-in types, or one the Head Table added on the form.
  kind: z.string().trim().min(2, "Choose or name a type").max(60),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().transform((v) => v || null),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  location: z.string().trim().max(200).optional().transform((v) => v || null),
  memberId: z.string().optional().transform((v) => v || null),
});

export async function saveCalendarEvent(id: string | null, input: z.input<typeof eventSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("calendar.manage");
    const d = eventSchema.parse(input);
    // Calendar items are whole-day now: no times are asked for, so the day
    // itself is the span and the calendar sorts by the date alone.
    const startsAt = istToDate(d.date, "00:00");
    const endsAt = istToDate(d.date, "23:59");
    const values = {
      kind: d.kind,
      title: d.title,
      description: d.description,
      startsAt,
      endsAt,
      location: d.location,
      link: null,
      memberId: d.memberId,
    };
    if (id) {
      const [before] = await db.select().from(calendarEvent).where(eq(calendarEvent.id, z.uuid().parse(id)));
      if (!before) throw new UserError("Calendar item not found.");
      await db.update(calendarEvent).set(values).where(eq(calendarEvent.id, before.id));
      await audit({ actorId: me.id, action: "calendar.update", entity: "calendar_event", entityId: before.id, after: d });
    } else {
      const [row] = await db
        .insert(calendarEvent)
        .values({ ...values, createdById: me.id })
        .returning({ id: calendarEvent.id });
      await audit({ actorId: me.id, action: "calendar.create", entity: "calendar_event", entityId: row.id, after: d });
    }
    refresh();
    return null;
  });
}

export async function deleteCalendarEvent(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("calendar.manage");
    const [row] = await db.select().from(calendarEvent).where(eq(calendarEvent.id, z.uuid().parse(id)));
    if (!row) throw new UserError("Calendar item not found.");
    await db.delete(calendarEvent).where(eq(calendarEvent.id, row.id));
    await audit({ actorId: me.id, action: "calendar.delete", entity: "calendar_event", entityId: row.id, before: row });
    refresh();
    return null;
  });
}
