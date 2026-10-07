"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { award, awardType, meeting } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { assertCap } from "@/lib/session";

const entrySchema = z.object({
  awardTypeId: z.uuid(),
  memberId: z.string().optional().transform((v) => v || null),
  note: z.string().trim().max(200).optional().transform((v) => v || null),
  value: z.string().trim().max(60).optional().transform((v) => v || null),
});

/**
 * Saves the week's winners for one meeting. Empty member = no winner for that
 * award. `publish` makes them visible to everyone and notifies the winners.
 */
export async function saveAwards(
  meetingId: string,
  entries: z.input<typeof entrySchema>[],
  publish: boolean,
): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("awards.manage");
    const [m] = await db.select().from(meeting).where(eq(meeting.id, z.uuid().parse(meetingId)));
    if (!m) throw new UserError("Meeting not found.");
    const parsed = z.array(entrySchema).max(20).parse(entries);
    const types = new Map((await db.select().from(awardType)).map((t) => [t.id, t]));

    await db.transaction(async (tx) => {
      for (const e of parsed) {
        const type = types.get(e.awardTypeId);
        if (!type) continue;
        if (!e.memberId) {
          await tx.delete(award).where(and(eq(award.meetingId, m.id), eq(award.awardTypeId, e.awardTypeId)));
          continue;
        }
        const values = {
          memberId: e.memberId,
          // Only the fields this recognition uses (e.g. Best Attire has neither).
          note: type.noteEnabled ? e.note : null,
          value: type.valueEnabled ? e.value : null,
          published: publish,
        };
        await tx
          .insert(award)
          .values({ meetingId: m.id, awardTypeId: e.awardTypeId, createdById: me.id, ...values })
          .onConflictDoUpdate({ target: [award.meetingId, award.awardTypeId], set: values });
      }
      await audit(
        { actorId: me.id, action: publish ? "awards.publish" : "awards.save_draft", entity: "meeting", entityId: m.id, after: parsed },
        tx,
      );
    });

    refresh();
    return null;
  });
}

/**
 * Clears a meeting's saved recognitions, draft or published. Only the winners
 * go: the meeting stays and can be picked again.
 */
export async function clearAwards(meetingId: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("awards.manage");
    const id = z.uuid().parse(meetingId);
    const removed = await db
      .delete(award)
      .where(eq(award.meetingId, id))
      .returning({ awardTypeId: award.awardTypeId, memberId: award.memberId, published: award.published });
    if (removed.length === 0) throw new UserError("Nothing is saved for this meeting yet.");
    await audit({ actorId: me.id, action: "awards.clear", entity: "meeting", entityId: id, before: removed });
    refresh();
    return null;
  });
}

/** Hides a meeting's recognitions again (e.g. published by mistake). */
export async function unpublishAwards(meetingId: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("awards.manage");
    const id = z.uuid().parse(meetingId);
    await db.update(award).set({ published: false }).where(eq(award.meetingId, id));
    await audit({ actorId: me.id, action: "awards.unpublish", entity: "meeting", entityId: id });
    refresh();
    return null;
  });
}
