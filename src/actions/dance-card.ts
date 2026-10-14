"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { danceCard, member } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { cleanAnswer, DANCE_CARD_FIELDS, isProfileField, maxAnswerLength } from "@/lib/dance-card";
import { AuthError, assertMember } from "@/lib/session";

/**
 * Saves a dance card: your own, or — for the Head Table and Admin, who keep the
 * member list — another member's, which is audit-logged.
 */
export async function saveDanceCard(input: Record<string, string>, memberId?: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    const forOther = memberId !== undefined && memberId !== me.id;
    let target: { id: string; fullName: string } = { id: me.id, fullName: me.fullName };
    if (forOther) {
      if (!me.caps.has("members.manage")) throw new AuthError();
      const [m] = await db
        .select({ id: member.id, fullName: member.fullName })
        .from(member)
        .where(and(eq(member.id, z.string().parse(memberId)), eq(member.status, "active")));
      if (!m) throw new UserError("That member isn't active any more.");
      target = m;
    }
    const data = z.record(z.string(), z.string().max(2000)).parse(input);
    const clean: Record<string, string> = {};
    for (const field of DANCE_CARD_FIELDS) {
      // Name, company, profession and location come from the profile every time
      // the card is read, so nothing sent for them is kept.
      if (isProfileField(field.key)) continue;
      const value = cleanAnswer(data[field.key] ?? "");
      if (!value) continue;
      const max = maxAnswerLength(field);
      if (value.length > max) {
        throw new UserError(`"${field.label}" is too long for the card: keep it under ${max} characters.`);
      }
      clean[field.key] = value;
    }
    await db
      .insert(danceCard)
      .values({ memberId: target.id, data: clean })
      .onConflictDoUpdate({ target: danceCard.memberId, set: { data: clean } });
    if (forOther) {
      await audit({
        actorId: me.id,
        action: "dance_card.update",
        entity: "member",
        entityId: target.id,
        after: { member: target.fullName },
      });
    }
    refresh();
    return null;
  });
}
