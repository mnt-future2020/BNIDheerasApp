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
 * The live state of a quiz, built fresh for every poll, and the cookie that
 * tells one player's browser from another's.
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

export type QuizPlayer = { id: string; name: string; memberId: string | null };

/**
 * Which player this browser is. A signed-in member is found by their account,
 * so clearing cookies or switching to another phone doesn't lose their answers;
 * a guest from the WhatsApp link is only ever the token in their cookie.
 */
export async function currentParticipant(quizId: string): Promise<QuizPlayer | null> {
  const columns = { id: quizParticipant.id, name: quizParticipant.name, memberId: quizParticipant.memberId };
  const me = await getCurrentMember();
  if (me) {
    const [byMember] = await db
      .select(columns)
      .from(quizParticipant)
      .where(and(eq(quizParticipant.quizId, quizId), eq(quizParticipant.memberId, me.id)));
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

/**
 * Everything one screen needs, read in one go. Called once a second per player,
 * so it stays four small queries; the chapter plays with a roomful of people and
 * a handful of questions, which is well inside what that costs.
 */
export async function quizStateFor(joinToken: string, now = new Date()): Promise<QuizState | null> {
  const [row] = await db.select().from(quiz).where(eq(quiz.joinToken, joinToken));
  if (!row) return null;

  const me = await getCurrentMember();
  const isHost = !!me?.caps.has("quiz.manage");
  const phase = quizPhase(row, now);
  const revealed = phase === "reveal" || phase === "ended";

  const [questions, players, answers, participant] = await Promise.all([
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
      .select({ id: quizParticipant.id, name: quizParticipant.name })
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
    currentParticipant(row.id),
  ]);

  const current = questions.find((q) => q.position === row.currentPosition) ?? null;
  const currentAnswers = current ? answers.filter((a) => a.questionId === current.id) : [];
  const nameOf = new Map(players.map((p) => [p.id, p.name]));

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
    fastest:
      current && revealed
        ? questionRanking(currentAnswers).map((r) => ({
            rank: r.rank,
            name: nameOf.get(r.participantId) ?? "Someone",
            ms: r.ms,
          }))
        : null,
    standings: quizLeaderboard(players, answers),
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
