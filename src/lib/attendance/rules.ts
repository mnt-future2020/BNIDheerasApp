import type { AttendanceStatus } from "@/db/schema";
import { toIstDateInput } from "@/lib/time";

/**
 * On time means checked in at or before start + grace. With no grace set
 * (null), the exact start time is the cut-off: 07:00:00 is on time and
 * 07:00:01 is late.
 */
export function lateCutoff(startsAt: Date, graceMinutes: number | null): Date {
  return new Date(startsAt.getTime() + (graceMinutes ?? 0) * 60_000);
}

export function statusForCheckin(
  checkedInAt: Date,
  startsAt: Date,
  graceMinutes: number | null,
): Extract<AttendanceStatus, "P" | "L"> {
  return checkedInAt.getTime() > lateCutoff(startsAt, graceMinutes).getTime() ? "L" : "P";
}

/**
 * When check-in stops, and with it a member's last chance to give a reason:
 * the deadline set on the meeting, or the end of the meeting when none is set.
 * Every window check goes through here so the three screens can't drift apart.
 */
export function checkinClosingTime(m: { checkinClosesAt: Date | null; endsAt: Date }): Date {
  return m.checkinClosesAt ?? m.endsAt;
}

/**
 * Why the Check in page offers no scanner to someone the Head Table has
 * already marked away. Members don't enter this themselves, so the way to
 * change it is to speak to the chapter, not to tap something here.
 */
export function planNotice(kind: "substitute" | "medical" | "informed"): string {
  const what =
    kind === "substitute"
      ? "Your substitute is expected, so there is nothing to check in to."
      : "You're down as not attending, so check-in is closed for you.";
  return `${what} Coming after all? Speak to the LVH team or the Secretary.`;
}

export const FUTURE_PALMS_MESSAGE = "This meeting hasn't happened yet. PALMS can be entered on the day of the meeting.";

/**
 * PALMS is entered on the day, often from the paper sheet hours after the
 * meeting — so the calendar day is what counts, never the clock. A meeting
 * later today is fine; tomorrow's is not.
 */
export function isFutureMeetingDay(startsAt: Date, now = new Date()): boolean {
  return toIstDateInput(startsAt) > toIstDateInput(now);
}

export type WindowVerdict = "open" | "not_open_yet" | "closed";

export function checkinWindow(now: Date, opensAt: Date, endsAt: Date): WindowVerdict {
  if (now.getTime() < opensAt.getTime()) return "not_open_yet";
  if (now.getTime() > endsAt.getTime()) return "closed";
  return "open";
}

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  P: "Present",
  L: "Late",
  A: "Absent",
  M: "Medical",
  S: "Substitute",
};

/** Human messages for check-in rejection reasons (shown to members and LVH). */
export const REJECTION_MESSAGES: Record<string, string> = {
  bad_qr: "That isn't a BNI Dheeras check-in QR. Scan the code on the venue screen.",
  qr_expired: "This QR has expired. Scan the screen again (it changes every 15 seconds).",
  qr_invalid: "This QR isn't valid. Scan the code on the venue screen.",
  meeting_not_found: "This meeting wasn't found.",
  meeting_closed: "This meeting is closed for check-in.",
  not_open_yet: "Check-in isn't open yet.",
  window_closed: "Check-in for this meeting has closed. Please see the LVH team.",
  no_device: "This phone isn't registered. Register it from your Home screen first.",
  device_pending: "This phone is waiting for approval. Show your approval code to the Attendance Coordinator.",
  device_revoked: "This phone's registration was removed. Register again and get it approved.",
  device_other_member: "This phone is registered to another member. Each member must use their own phone.",
  bad_signature: "This phone couldn't prove its identity. Re-open the app and try again.",
  rate_limited: "Too many attempts. Wait a few minutes and try again, or see the LVH team.",
  already: "You're already checked in.",
  inactive: "Your membership is not active.",
  pass_expired: "This pass has expired. Ask the member to refresh it.",
  pass_invalid: "This isn't a valid member pass.",
};
