"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { leaveRequest, member } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { getMeetingWithVenue } from "@/lib/attendance/queries";
import { audit } from "@/lib/audit";
import { assertCap } from "@/lib/session";

/* Members don't say "can't attend" from their phone — there is no such option.
   An absence reaches the record one way: the Head Table writes down what they
   were told, on the PALMS sheet. */

const recordSchema = z.object({
  meetingId: z.uuid(),
  memberId: z.uuid("Choose the member"),
  kind: z.enum(["medical", "informed"]),
  reason: z.string().trim().min(2, "Write what they said").max(300),
});

/**
 * A member who told the Head Table they can't attend — on the phone, in the
 * WhatsApp group, in person. Written down from the PALMS sheet, on the letter
 * that says they were away. The Head Table writing it down is the decision, so
 * it is recorded as approved and the sheet keeps that member marked: M for
 * medical leave, A for anything else.
 */
export async function recordAbsence(input: z.input<typeof recordSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("attendance.manual");
    const data = recordSchema.parse(input);
    const m = await getMeetingWithVenue(data.meetingId);
    if (!m) throw new UserError("Meeting not found.");
    if (m.status === "finalized") throw new UserError("This meeting is finalized. Reopen it to change PALMS.");
    if (m.status === "cancelled") throw new UserError("This meeting was cancelled.");
    const [who] = await db
      .select({ name: member.fullName, isChapterMember: member.isChapterMember })
      .from(member)
      .where(eq(member.id, data.memberId));
    if (!who?.isChapterMember) throw new UserError("That isn't a chapter member.");
    await db
      .insert(leaveRequest)
      .values({
        meetingId: m.id,
        memberId: data.memberId,
        kind: data.kind,
        reason: data.reason,
        status: "approved",
        decidedById: me.id,
        decidedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [leaveRequest.meetingId, leaveRequest.memberId],
        set: {
          kind: data.kind,
          reason: data.reason,
          status: "approved",
          decidedById: me.id,
          decidedAt: new Date(),
        },
      });
    await audit({
      actorId: me.id,
      action: "leave.record",
      entity: "meeting",
      entityId: m.id,
      reason: data.reason,
      after: { member: who.name, kind: data.kind },
    });
    refresh();
    return null;
  });
}
