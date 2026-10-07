"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { leaveRequest, member, substitute } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { getMeetingWithVenue } from "@/lib/attendance/queries";
import { planDeadline, undoDeadline } from "@/lib/attendance/rules";
import { audit } from "@/lib/audit";
import { normalizePhone } from "@/lib/members";
import { assertAnyCap, assertCap, assertMember } from "@/lib/session";

const TOO_LATE = "It's too late to change this for the meeting. Please speak to the LVH team or the Secretary.";

/** Giving a reason or sending a substitute stays open until the meeting ends. */
async function openMeetingForMember(meetingId: string) {
  const m = await getMeetingWithVenue(meetingId);
  if (!m || m.status !== "scheduled") throw new UserError("This meeting isn't open.");
  if (Date.now() >= planDeadline(m).getTime()) throw new UserError(TOO_LATE);
  return m;
}

/** Taking it back is allowed for longer — until the meeting itself starts. */
async function undoableMeeting(meetingId: string) {
  const m = await getMeetingWithVenue(meetingId);
  if (!m || m.status !== "scheduled") throw new UserError("This meeting isn't open.");
  if (Date.now() >= undoDeadline(m).getTime()) {
    throw new UserError("The meeting has started, so this can't be undone. Speak to the LVH team or the Secretary.");
  }
  return m;
}

const leaveSchema = z.object({
  meetingId: z.uuid(),
  kind: z.enum(["medical", "informed"]),
  reason: z.string().trim().max(300).optional(),
});

export async function requestLeave(input: z.input<typeof leaveSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    if (!me.isChapterMember) throw new UserError("This is an admin account, not a chapter member.");
    const data = leaveSchema.parse(input);
    const m = await openMeetingForMember(data.meetingId);
    const status = data.kind === "informed" ? "approved" : "pending";
    await db
      .insert(leaveRequest)
      .values({ meetingId: m.id, memberId: me.id, kind: data.kind, reason: data.reason, status })
      .onConflictDoUpdate({
        target: [leaveRequest.meetingId, leaveRequest.memberId],
        set: { kind: data.kind, reason: data.reason, status, decidedAt: null, decidedById: null },
      });
    await audit({ actorId: me.id, action: `leave.${data.kind}`, entity: "meeting", entityId: m.id, reason: data.reason });
    refresh();
    return null;
  });
}

const subSchema = z.object({
  meetingId: z.uuid(),
  name: z.string().trim().min(2, "Enter the substitute's name").max(120),
  phone: z.string().trim().min(8, "Enter a phone number").max(20),
  business: z.string().trim().max(160).optional(),
});

export async function registerSubstitute(input: z.input<typeof subSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    if (!me.isChapterMember) throw new UserError("This is an admin account, not a chapter member.");
    const data = subSchema.parse(input);
    const m = await openMeetingForMember(data.meetingId);
    const phone = normalizePhone(data.phone)!;
    await db
      .insert(substitute)
      .values({ meetingId: m.id, memberId: me.id, name: data.name, phone, business: data.business })
      .onConflictDoUpdate({
        target: [substitute.meetingId, substitute.memberId],
        set: { name: data.name, phone, business: data.business, arrivedAt: null, confirmedById: null },
      });
    await audit({ actorId: me.id, action: "substitute.register", entity: "meeting", entityId: m.id, after: { name: data.name } });
    refresh();
    return null;
  });
}

export async function cancelPlan(meetingId: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    const m = await undoableMeeting(z.uuid().parse(meetingId));
    await db.delete(leaveRequest).where(and(eq(leaveRequest.meetingId, m.id), eq(leaveRequest.memberId, me.id)));
    await db.delete(substitute).where(and(eq(substitute.meetingId, m.id), eq(substitute.memberId, me.id)));
    await audit({ actorId: me.id, action: "leave.cancel", entity: "meeting", entityId: m.id });
    refresh();
    return null;
  });
}

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
    const me = await assertAnyCap(["attendance.manual", "leave.approve"]);
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

export async function decideLeave(id: string, approve: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("leave.approve");
    const [current] = await db.select().from(leaveRequest).where(eq(leaveRequest.id, z.uuid().parse(id)));
    if (!current) throw new UserError("Request not found.");
    if (current.memberId === me.id && !me.fullAccess) throw new UserError("Someone else must decide your own leave.");
    const [row] = await db
      .update(leaveRequest)
      .set({ status: approve ? "approved" : "rejected", decidedById: me.id, decidedAt: new Date() })
      .where(eq(leaveRequest.id, current.id))
      .returning();
    const [who] = await db.select({ fullName: member.fullName }).from(member).where(eq(member.id, row.memberId));
    await audit({
      actorId: me.id,
      action: approve ? "leave.approve" : "leave.reject",
      entity: "leave_request",
      entityId: row.id,
      after: { member: who?.fullName },
    });
    refresh();
    return null;
  });
}
