import { timingSafeEqual } from "node:crypto";
import { pruneLoginAttempts } from "@/lib/passwords";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Weekly housekeeping, called by whatever scheduler the host runs on Mondays
 * with `Authorization: Bearer $CRON_SECRET`. It used to send the attendance
 * report as a notification; with notifications gone it only clears out the
 * login-attempt log, which would otherwise grow for ever.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  await pruneLoginAttempts();
  return Response.json({ ok: true });
}
