import { NextResponse } from "next/server";
import { APP_BUILD } from "@/lib/app-build";

export const dynamic = "force-dynamic";

/**
 * Which build is live right now. Asked by every open copy of the app when it
 * comes back to the foreground, so a member who has had it on their home screen
 * for months is offered the new version instead of running last term's one.
 *
 * Signed out on purpose: it carries nothing but a build date, and a window
 * whose session has lapsed still needs to be told to reload.
 */
export async function GET() {
  return NextResponse.json({ build: APP_BUILD }, { headers: { "Cache-Control": "no-store" } });
}
