"use server";

import { z } from "zod";
import { type CheckinResult, selfCheckin } from "@/lib/attendance/service";
import { requestMeta } from "@/lib/request-meta";
import { assertMember } from "@/lib/session";

const checkinSchema = z.object({
  qrToken: z.string().min(10).max(200),
  thumbprint: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  signature: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
});

/** Member scanned the venue QR on their own phone. */
export async function checkIn(input: z.input<typeof checkinSchema>): Promise<CheckinResult> {
  let me;
  try {
    me = await assertMember();
  } catch {
    return { ok: false, reason: "inactive" };
  }
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "bad_qr" };
  return selfCheckin({
    memberId: me.id,
    memberName: me.fullName,
    qrToken: parsed.data.qrToken,
    thumbprint: parsed.data.thumbprint,
    signature: parsed.data.signature,
    meta: await requestMeta(),
  });
}
