"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { absenceFollowup, meeting } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { FUTURE_PALMS_MESSAGE, isFutureMeetingDay } from "@/lib/attendance/rules";
import { finalizeMeeting } from "@/lib/attendance/service";
import { audit } from "@/lib/audit";
import { assertAnyCap, assertCap } from "@/lib/session";

const reason = z.string().trim().min(3, "Give a reason (at least 3 characters)").max(200);

export async function lvhFinalize(input: { meetingId: string; headcount: number | null }): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("meeting.finalize");
    const headcount = input.headcount === null ? null : z.number().int().min(0).max(500).parse(input.headcount);
    const meetingId = z.uuid().parse(input.meetingId);
    // The visitor count is part of PALMS; locking without it loses it for good.
    const [m] = await db.select({ visitors: meeting.visitorCount }).from(meeting).where(eq(meeting.id, meetingId));
    if (!m) throw new UserError("Meeting not found.");
    if (m.visitors === null) {
      throw new UserError("Enter the visitor count first (0 if there were none), on the meeting's Visitors page.");
    }
    await finalizeMeeting({ actorId: me.id, meetingId, headcount });
    refresh();
    return null;
  });
}

/**
 * Opens a finalized meeting again so the LVH team can correct a status on the
 * board, then finalize again. The reason goes into the audit log.
 */
export async function lvhReopen(input: { meetingId: string; reason: string }): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("meeting.finalize");
    const meetingId = z.uuid().parse(input.meetingId);
    const why = reason.parse(input.reason);
    const [row] = await db
      .update(meeting)
      .set({ status: "scheduled", finalizedAt: null, finalizedById: null })
      .where(and(eq(meeting.id, meetingId), eq(meeting.status, "finalized")))
      .returning({ id: meeting.id });
    if (!row) throw new UserError("Only a finalized meeting can be reopened.");
    await audit({ actorId: me.id, action: "meeting.reopen", entity: "meeting", entityId: meetingId, reason: why });
    refresh();
    return null;
  });
}

/**
 * Members physically in the room, counted by the Attendance Coordinator. It is
 * the check on PALMS: the number should match Present + Late, and the summary
 * says so when it doesn't. Empty clears it back to "not counted".
 */
export async function setHeadcount(input: { meetingId: string; count: number | null }): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertAnyCap(["attendance.manual", "meeting.finalize"]);
    const meetingId = z.uuid().parse(input.meetingId);
    const count = input.count === null ? null : z.number().int().min(0).max(500).parse(input.count);
    const [m] = await db.select().from(meeting).where(eq(meeting.id, meetingId));
    if (!m) throw new UserError("Meeting not found.");
    if (m.status === "cancelled") throw new UserError("This meeting was cancelled.");
    if (m.status === "finalized") {
      throw new UserError('This meeting is finalized. Use "Reopen for corrections" on the PALMS summary first.');
    }
    if (isFutureMeetingDay(m.startsAt)) throw new UserError(FUTURE_PALMS_MESSAGE);
    await db.update(meeting).set({ headcount: count }).where(eq(meeting.id, meetingId));
    await audit({ actorId: me.id, action: "meeting.headcount", entity: "meeting", entityId: meetingId, after: { count } });
    refresh();
    return null;
  });
}

/** Attendance Coordinator ticks off absentee calls (24-hour follow-up). */
export async function saveFollowup(input: { meetingId: string; memberId: string; called: boolean; note?: string }): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertAnyCap(["palms.view", "meeting.finalize"]);
    const values = {
      calledById: input.called ? me.id : null,
      calledAt: input.called ? new Date() : null,
      note: input.note?.trim().slice(0, 300) || null,
    };
    await db
      .insert(absenceFollowup)
      .values({ meetingId: z.uuid().parse(input.meetingId), memberId: input.memberId, ...values })
      .onConflictDoUpdate({ target: [absenceFollowup.meetingId, absenceFollowup.memberId], set: values });
    await audit({
      actorId: me.id,
      action: "absence.followup",
      entity: "meeting",
      entityId: input.meetingId,
      after: { memberId: input.memberId, called: input.called },
    });
    refresh();
    return null;
  });
}
