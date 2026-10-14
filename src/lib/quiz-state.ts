import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { quiz, quizAnswer, quizParticipant, quizQuestion } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { msLeft, type QuizState, quizLeaderboard, questionRanking, quizPhase } from "@/lib/quiz";
import { getCurrentMember } from "@/lib/session";

/**
 * The live state of a quiz, built for every poll from one shared read of the
 * database, and the cookie that tells one player's browser from another's.
 */

const COOKIE_PREFIX = "bni_quiz_";
/** A quiz is played in one sitting; the cookie only has to outlast the meeting. */
const COOKIE_MAX_AGE = 60 * 60 * 12;

export const quizCookieName = (quizId: string) => `${COOKIE_PREFIX}${quizId}`;

/**
 * The address a player opens, worked out on the server so the QR and the link
 * are right in the first render. Guessing it in the browser instead would make
 * the server's HTML disagree with the client's, and the QR flicker as it settles.
 */
export async function quizJoinUrl(joinToken: string): Promise<string> {
  const configured = appUrl();
  if (configured) return `${configured}/quiz/${joinToken}`;
  // No NEXT_PUBLIC_APP_URL (local work): whatever host served this request.
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? (local ? "http" : "https");
  return `${proto}://${host}/quiz/${joinToken}`;
}

const hashToken = (token: string) =>
  createHash("sha256")
    .update(`${process.env.BETTER_AUTH_SECRET ?? "dev"}|quiz:${token}`)
    .digest("base64url");

/** A new player's secret, kept in their browser and stored here only as a hash. */
export function newParticipantToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export async function setParticipantCookie(quizId: string, token: string): Promise<void> {
  (await cookies()).set(quizCookieName(quizId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/** Drops anything past its time once a cache has grown, so stray keys can't pile up. */
function prune<V extends { at: number }>(map: Map<string, V>, ttlMs: number, soft: number) {
  if (map.size <= soft) return;
  const now = Date.now();
  for (const [key, entry] of map) if (now - entry.at >= ttlMs) map.delete(key);
  if (map.size > soft * 2) map.clear();
}

/* ------------------------------------------------------------------ */
/* Who is looking                                                      */
/* ------------------------------------------------------------------ */

type QuizViewer = { memberId: string | null; isHost: boolean };

/**
 * How long a signed-in phone's account is remembered between polls. Working it
 * out is three queries (session, member, roles); a member polling once a second
 * would otherwise spend more on proving who they are than on the quiz.
 */
const VIEWER_TTL_MS = 30_000;
const viewers = new Map<string, { at: number; value: Promise<QuizViewer> }>();

/**
 * The member behind this request, if any, and whether they run quizzes. Keyed
 * by their session cookie, so signing out or in shows up on the next poll.
 */
async function quizViewer(): Promise<QuizViewer> {
  const session = (await cookies())
    .getAll()
    .find((c) => c.name.endsWith("better-auth.session_token"))?.value;
  if (!session) return { memberId: null, isHost: false };

  const hit = viewers.get(session);
  if (hit && Date.now() - hit.at < VIEWER_TTL_MS) return hit.value;
  const value = getCurrentMember().then((me) => ({
    memberId: me?.id ?? null,
    isHost: !!me?.caps.has("quiz.manage"),
  }));
  value.catch(() => {
    if (viewers.get(session)?.value === value) viewers.delete(session);
  });
  prune(viewers, VIEWER_TTL_MS, 500);
  viewers.set(session, { at: Date.now(), value });
  return value;
}

export type QuizPlayer = { id: string; name: string; memberId: string | null };

/**
 * Which player this browser is. A signed-in member is found by their account,
 * so clearing cookies or switching to another phone doesn't lose their answers;
 * a guest from the WhatsApp link is only ever the token in their cookie.
 */
export async function currentParticipant(quizId: string): Promise<QuizPlayer | null> {
  const columns = { id: quizParticipant.id, name: quizParticipant.name, memberId: quizParticipant.memberId };
  const { memberId } = await quizViewer();
  if (memberId) {
    const [byMember] = await db
      .select(columns)
      .from(quizParticipant)
      .where(and(eq(quizParticipant.quizId, quizId), eq(quizParticipant.memberId, memberId)));
    if (byMember) return byMember;
  }
  // No account, or signed in but joined as a guest before signing in.
  const token = (await cookies()).get(quizCookieName(quizId))?.value;
  if (!token) return null;
  const [byToken] = await db
    .select(columns)
    .from(quizParticipant)
    .where(and(eq(quizParticipant.quizId, quizId), eq(quizParticipant.tokenHash, hashToken(token))));
  return byToken ?? null;
}

/** True when a name is already taken in this quiz, whoever is wearing it. */
export async function nameTaken(quizId: string, name: string, exceptId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: quizParticipant.id, name: quizParticipant.name })
    .from(quizParticipant)
    .where(eq(quizParticipant.quizId, quizId));
  const wanted = name.trim().toLowerCase();
  return rows.some((r) => r.id !== exceptId && r.name.trim().toLowerCase() === wanted);
}

/* ------------------------------------------------------------------ */
/* What the room is looking at                                         */
/* ------------------------------------------------------------------ */

/**
 * How long one read of a quiz serves every screen polling it. Each phone asks
 * once a second, so reading per poll is a roomful of 60 sending hundreds of
 * queries a second through a pool of a few connections — and the queue that
 * builds up delays every screen and every answer. Shared, the database sees
 * about one read a second per quiz, however many are playing.
 *
 * The clock isn't part of what is kept: the phase and the countdown are worked
 * out from the cached row on every poll, so a question still closes on time.
 * The host's taps and new players clear it at once (`forgetQuizState`); a new
 * answer only reaches the host's count and the reveal within this long.
 */
const SNAPSHOT_TTL_MS = 1000;

async function readSnapshot(joinToken: string) {
  const [row] = await db.select().from(quiz).where(eq(quiz.joinToken, joinToken));
  if (!row) return null;

  const [questions, players, answers] = await Promise.all([
    db
      .select({
        id: quizQuestion.id,
        position: quizQuestion.position,
        text: quizQuestion.text,
        options: quizQuestion.options,
        correctIndex: quizQuestion.correctIndex,
      })
      .from(quizQuestion)
      .where(eq(quizQuestion.quizId, row.id))
      .orderBy(asc(quizQuestion.position)),
    db
      .select({
        id: quizParticipant.id,
        name: quizParticipant.name,
        memberId: quizParticipant.memberId,
        tokenHash: quizParticipant.tokenHash,
      })
      .from(quizParticipant)
      .where(eq(quizParticipant.quizId, row.id))
      .orderBy(asc(quizParticipant.createdAt)),
    db
      .select({
        questionId: quizAnswer.questionId,
        participantId: quizAnswer.participantId,
        optionIndex: quizAnswer.optionIndex,
        correct: quizAnswer.correct,
        ms: quizAnswer.ms,
      })
      .from(quizAnswer)
      .innerJoin(quizQuestion, eq(quizQuestion.id, quizAnswer.questionId))
      .where(eq(quizQuestion.quizId, row.id)),
  ]);

  const current = questions.find((q) => q.position === row.currentPosition) ?? null;
  const currentAnswers = current ? answers.filter((a) => a.questionId === current.id) : [];
  const nameOf = new Map(players.map((p) => [p.id, p.name]));

  return {
    row,
    questions,
    players,
    current,
    currentAnswers,
    // The same for every screen, so worked out once per read rather than per poll.
    standings: quizLeaderboard(players, answers),
    fastest: questionRanking(currentAnswers).map((r) => ({
      rank: r.rank,
      name: nameOf.get(r.participantId) ?? "Someone",
      ms: r.ms,
    })),
  };
}

type Snapshot = Awaited<ReturnType<typeof readSnapshot>>;
const snapshots = new Map<string, { at: number; value: Promise<Snapshot> }>();

/** One read in flight per quiz: polls that land together all wait on the same one. */
function quizSnapshot(joinToken: string): Promise<Snapshot> {
  const hit = snapshots.get(joinToken);
  if (hit && Date.now() - hit.at < SNAPSHOT_TTL_MS) return hit.value;
  const value = readSnapshot(joinToken);
  // A failed read isn't kept: the next poll tries again.
  value.catch(() => {
    if (snapshots.get(joinToken)?.value === value) snapshots.delete(joinToken);
  });
  prune(snapshots, SNAPSHOT_TTL_MS, 50);
  snapshots.set(joinToken, { at: Date.now(), value });
  return value;
}

/**
 * Makes the next poll read the database again. Called after anything that
 * changes what the room sees — the host moving the quiz on, someone joining —
 * so screens move the moment the host does rather than up to a second later.
 */
export function forgetQuizState(): void {
  snapshots.clear();
}

/** Everything one screen needs. Called once a second per player. */
export async function quizStateFor(joinToken: string): Promise<QuizState | null> {
  const snap = await quizSnapshot(joinToken);
  if (!snap) return null;
  const { row, questions, current, currentAnswers } = snap;

  const viewer = await quizViewer();
  const guestToken = (await cookies()).get(quizCookieName(row.id))?.value;
  const guestHash = guestToken ? hashToken(guestToken) : null;
  // The same order as `currentParticipant`: the account first, then the cookie.
  const participant =
    (viewer.memberId && snap.players.find((p) => p.memberId === viewer.memberId)) ||
    (guestHash && snap.players.find((p) => p.tokenHash === guestHash)) ||
    null;

  const now = new Date();
  const isHost = viewer.isHost;
  const phase = quizPhase(row, now);
  const revealed = phase === "reveal" || phase === "ended";
  const mine = participant ? currentAnswers.find((a) => a.participantId === participant.id) : undefined;

  return {
    quiz: {
      id: row.id,
      name: row.name,
      playsOn: row.playsOn,
      status: row.status,
      secondsPerQuestion: row.secondsPerQuestion,
      questionCount: questions.length,
    },
    phase,
    msLeft: msLeft(row, now),
    me: participant
      ? {
          id: participant.id,
          name: participant.name,
          answeredIndex: mine?.optionIndex ?? null,
          answeredMs: mine?.ms ?? null,
          // Whether they got it right is part of the reveal, not of answering.
          answeredCorrect: mine && revealed ? mine.correct : null,
        }
      : null,
    question:
      current && (phase === "question" || phase === "reveal")
        ? {
            position: current.position,
            total: questions.length,
            text: current.text,
            options: current.options,
            correctIndex: revealed || isHost ? current.correctIndex : null,
          }
        : null,
    fastest: current && revealed ? snap.fastest : null,
    standings: snap.standings,
    answeredCount: isHost ? currentAnswers.length : null,
    isHost,
  };
}

/** The quiz behind an admin screen, with its questions. */
export async function quizWithQuestions(quizId: string) {
  const [row] = await db.select().from(quiz).where(eq(quiz.id, quizId));
  if (!row) return null;
  const questions = await db
    .select()
    .from(quizQuestion)
    .where(eq(quizQuestion.quizId, row.id))
    .orderBy(asc(quizQuestion.position));
  return { quiz: row, questions };
}

/** Guests only, for the "who is in the room" count on the admin list. */
export async function guestCount(quizId: string): Promise<number> {
  const rows = await db
    .select({ id: quizParticipant.id })
    .from(quizParticipant)
    .where(and(eq(quizParticipant.quizId, quizId), isNull(quizParticipant.memberId)));
  return rows.length;
}
