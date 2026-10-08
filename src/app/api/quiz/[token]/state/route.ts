import { NextResponse } from "next/server";
import { quizStateFor } from "@/lib/quiz-state";

export const dynamic = "force-dynamic";

/**
 * Polled about once a second by every phone in the room and by the host's
 * screen. The join token in the path is the only key needed: a guest playing
 * from the WhatsApp link has no account to authenticate with.
 *
 * What a player may see is decided in `quizStateFor` — the right answer is held
 * back until the question closes.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/quiz/[token]/state">) {
  const { token } = await ctx.params;
  const state = await quizStateFor(token);
  if (!state) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}
