"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  QUIZ_MAX_OPTIONS,
  QUIZ_MIN_OPTIONS,
  QUIZ_SECONDS_DEFAULT,
  QUIZ_SECONDS_MAX,
  QUIZ_SECONDS_MIN,
  quiz,
  quizAnswer,
  quizParticipant,
  quizQuestion,
} from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { isUniqueViolation } from "@/lib/db-errors";
import { answersOpen, joinOpen } from "@/lib/quiz";
import { currentParticipant, nameTaken, newParticipantToken, setParticipantCookie } from "@/lib/quiz-state";
import { assertCap, getCurrentMember } from "@/lib/session";

/** A roomful and then some. Past this, somebody is playing with the join link. */
const MAX_PLAYERS = 300;
const MAX_QUESTIONS = 50;

const quizSchema = z.object({
  name: z.string().trim().min(3, "Give the quiz a name.").max(100),
  playsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date it is played on."),
  secondsPerQuestion: z.coerce
    .number()
    .int()
    .min(QUIZ_SECONDS_MIN)
    .max(QUIZ_SECONDS_MAX)
    .default(QUIZ_SECONDS_DEFAULT),
});

const questionsSchema = z.object({
  quizId: z.uuid(),
  questions: z
    .array(
      z
        .object({
          text: z.string().trim().min(3, "Type the question.").max(300),
          options: z
            .array(z.string().trim().max(120))
            // Blanks are empty slots, not choices: a host who fills three of
            // four boxes means a three-option question.
            .transform((list) => list.map((o) => o.trim()).filter(Boolean))
            .pipe(
              z
                .array(z.string())
                .min(QUIZ_MIN_OPTIONS, "Give at least two options.")
                .max(QUIZ_MAX_OPTIONS, `No more than ${QUIZ_MAX_OPTIONS} options.`),
            ),
          correctIndex: z.coerce.number().int().min(0).max(QUIZ_MAX_OPTIONS - 1),
        })
        .refine((q) => q.correctIndex < q.options.length, {
          message: "Mark which option is the right one.",
          path: ["correctIndex"],
        }),
    )
    .min(1, "A quiz needs at least one question.")
    .max(MAX_QUESTIONS),
});

/** The quiz row, or a readable error. */
async function loadQuiz(id: string) {
  const [row] = await db.select().from(quiz).where(eq(quiz.id, z.uuid().parse(id)));
  if (!row) throw new UserError("Quiz not found.");
  return row;
}

export async function createQuiz(input: z.input<typeof quizSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const me = await assertCap("quiz.manage");
    const data = quizSchema.parse(input);
    const [row] = await db
      .insert(quiz)
      .values({ ...data, createdById: me.id })
      .returning({ id: quiz.id });
    await audit({ actorId: me.id, action: "quiz.create", entity: "quiz", entityId: row.id, after: data });
    refresh();
    return { id: row.id };
  });
}

export async function updateQuiz(id: string, input: z.input<typeof quizSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("quiz.manage");
    const before = await loadQuiz(id);
    const data = quizSchema.parse(input);
    // Changing the clock mid-quiz would move the deadline of the question that
    // is already on screen, and with it everyone's answer times.
    if (before.status === "live" && data.secondsPerQuestion !== before.secondsPerQuestion) {
      throw new UserError("This quiz is being played. The seconds per question can't change now.");
    }
    await db.update(quiz).set(data).where(eq(quiz.id, before.id));
    await audit({ actorId: me.id, action: "quiz.update", entity: "quiz", entityId: before.id, before, after: data });
    refresh();
    return null;
  });
}

export async function deleteQuiz(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("quiz.manage");
    const row = await loadQuiz(id);
    if (row.status === "live") throw new UserError("Finish the quiz before deleting it.");
    // Questions, players and answers go with it (cascade).
    await db.delete(quiz).where(eq(quiz.id, row.id));
    await audit({ actorId: me.id, action: "quiz.delete", entity: "quiz", entityId: row.id, before: row });
    refresh();
    return null;
  });
}

/** Replaces the whole question list. Only before the quiz is played. */
export async function saveQuestions(input: z.input<typeof questionsSchema>): Promise<ActionResult<{ saved: number }>> {
  return runAction(async () => {
    const me = await assertCap("quiz.manage");
    const data = questionsSchema.parse(input);
    const row = await loadQuiz(data.quizId);
    if (row.status === "live" || row.status === "ended") {
      throw new UserError("This quiz has been played. Reset it before changing the questions.");
    }
    const rows = data.questions.map((q, i) => ({
      quizId: row.id,
      position: i + 1,
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
    }));
    await db.transaction(async (tx) => {
      await tx.delete(quizQuestion).where(eq(quizQuestion.quizId, row.id));
      await tx.insert(quizQuestion).values(rows);
      await audit(
        {
          actorId: me.id,
          action: "quiz.questions",
          entity: "quiz",
          entityId: row.id,
          after: { title: row.name, questions: rows.length },
        },
        tx,
      );
    });
    refresh();
    return { saved: rows.length };
  });
}

/** Opens the lobby: the QR and the link start working and people can join. */
export async function openQuiz(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("quiz.manage");
    const row = await loadQuiz(id);
    if (row.status !== "draft") throw new UserError("This quiz is already open.");
    const [first] = await db
      .select({ id: quizQuestion.id })
      .from(quizQuestion)
      .where(eq(quizQuestion.quizId, row.id))
      .limit(1);
    if (!first) throw new UserError("Add a question before opening the quiz.");
    await db.update(quiz).set({ status: "open" }).where(eq(quiz.id, row.id));
    await audit({ actorId: me.id, action: "quiz.open", entity: "quiz", entityId: row.id, after: { title: row.name } });
    refresh();
    return null;
  });
}

/** First question up. Answer times are measured from this moment. */
export async function startQuiz(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("quiz.manage");
    const row = await loadQuiz(id);
    if (row.status === "live") throw new UserError("This quiz is already being played.");
    if (row.status !== "open") throw new UserError("Open the quiz for joining first.");
    const now = new Date();
    await db
      .update(quiz)
      .set({ status: "live", currentPosition: 1, questionStartedAt: now, questionEndedAt: null, startedAt: now })
      .where(eq(quiz.id, row.id));
    await audit({ actorId: me.id, action: "quiz.start", entity: "quiz", entityId: row.id, after: { title: row.name } });
    return null;
  });
}

/** Closes the question on screen now, instead of waiting out its seconds. */
export async function revealAnswer(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await assertCap("quiz.manage");
    const row = await loadQuiz(id);
    if (row.status !== "live" || row.currentPosition < 1) throw new UserError("No question is on screen.");
    if (row.questionEndedAt) return null;
    await db.update(quiz).set({ questionEndedAt: new Date() }).where(eq(quiz.id, row.id));
    return null;
  });
}

/**
 * The next question, or the end of the quiz when that was the last one. The
 * host taps this when the room has finished reading the places.
 */
export async function nextQuestion(id: string): Promise<ActionResult<{ position: number; ended: boolean }>> {
  return runAction(async () => {
    const me = await assertCap("quiz.manage");
    const row = await loadQuiz(id);
    if (row.status !== "live") throw new UserError("This quiz isn't being played.");
    const questions = await db
      .select({ position: quizQuestion.position })
      .from(quizQuestion)
      .where(eq(quizQuestion.quizId, row.id))
      .orderBy(asc(quizQuestion.position));
    const next = questions.find((q) => q.position > row.currentPosition);
    if (!next) {
      await db.update(quiz).set({ status: "ended", endedAt: new Date() }).where(eq(quiz.id, row.id));
      await audit({ actorId: me.id, action: "quiz.end", entity: "quiz", entityId: row.id, after: { title: row.name } });
      refresh();
      return { position: row.currentPosition, ended: true };
    }
    await db
      .update(quiz)
      .set({ currentPosition: next.position, questionStartedAt: new Date(), questionEndedAt: null })
      .where(eq(quiz.id, row.id));
    return { position: next.position, ended: false };
  });
}

/** Stops the quiz where it is and shows the final places. */
export async function endQuiz(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("quiz.manage");
    const row = await loadQuiz(id);
    if (row.status === "ended") return null;
    await db.update(quiz).set({ status: "ended", endedAt: new Date() }).where(eq(quiz.id, row.id));
    await audit({ actorId: me.id, action: "quiz.end", entity: "quiz", entityId: row.id, after: { title: row.name } });
    refresh();
    return null;
  });
}

/**
 * Back to a draft, with the players and their answers cleared — for a rehearsal
 * before the meeting, or a round that has to be played again. The questions stay.
 */
export async function resetQuiz(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("quiz.manage");
    const row = await loadQuiz(id);
    const players = await db
      .select({ id: quizParticipant.id })
      .from(quizParticipant)
      .where(eq(quizParticipant.quizId, row.id));
    await db.transaction(async (tx) => {
      // Answers go with their player (cascade).
      await tx.delete(quizParticipant).where(eq(quizParticipant.quizId, row.id));
      await tx
        .update(quiz)
        .set({
          status: "draft",
          currentPosition: 0,
          questionStartedAt: null,
          questionEndedAt: null,
          startedAt: null,
          endedAt: null,
        })
        .where(eq(quiz.id, row.id));
      await audit(
        {
          actorId: me.id,
          action: "quiz.reset",
          entity: "quiz",
          entityId: row.id,
          before: { title: row.name, status: row.status, players: players.length },
        },
        tx,
      );
    });
    refresh();
    return null;
  });
}

/* ------------------------------------------------------------------ */
/* Playing: no capability, and no account needed                       */
/* ------------------------------------------------------------------ */

const joinSchema = z.object({
  joinToken: z.string().trim().min(10).max(64),
  name: z.string().trim().min(2, "Type your name.").max(40),
});

/**
 * Joins a quiz from its link. Anyone holding the link can play, with or without
 * an app account — which is the point of sending the QR round on WhatsApp.
 */
export async function joinQuiz(input: z.input<typeof joinSchema>): Promise<ActionResult<{ name: string }>> {
  return runAction(async () => {
    const data = joinSchema.parse(input);
    const [row] = await db.select().from(quiz).where(eq(quiz.joinToken, data.joinToken));
    if (!row) throw new UserError("That quiz link doesn't work.");
    if (row.status === "draft") throw new UserError("This quiz hasn't opened yet. Hold on for the host.");
    if (!joinOpen(row.status)) throw new UserError("This quiz has finished.");

    // Already in: tapping Join twice, or coming back after closing the tab.
    const existing = await currentParticipant(row.id);
    if (existing) return { name: existing.name };

    const me = await getCurrentMember();
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quizParticipant)
      .where(eq(quizParticipant.quizId, row.id));
    if (count >= MAX_PLAYERS) throw new UserError("This quiz is full.");
    if (await nameTaken(row.id, data.name)) {
      throw new UserError(`Somebody has already joined as "${data.name}". Add your surname and try again.`);
    }

    const { token, tokenHash } = newParticipantToken();
    try {
      await db.insert(quizParticipant).values({
        quizId: row.id,
        name: data.name,
        memberId: me?.id ?? null,
        tokenHash,
      });
    } catch (error) {
      // Two people typing the same name at once, or one member on two phones.
      if (isUniqueViolation(error)) throw new UserError("That name was just taken. Try another one.");
      throw error;
    }
    await setParticipantCookie(row.id, token);
    return { name: data.name };
  });
}

const answerSchema = z.object({
  joinToken: z.string().trim().min(10).max(64),
  optionIndex: z.coerce.number().int().min(0).max(QUIZ_MAX_OPTIONS - 1),
});

/**
 * One tap on one question. The time that counts is the server's — from when the
 * question went up to now — so a slow phone can't be talked into a better place.
 *
 * Nothing in the result says whether the answer was right: that belongs to the
 * reveal, when the whole room sees it at once.
 */
export async function answerQuestion(
  input: z.input<typeof answerSchema>,
): Promise<ActionResult<{ optionIndex: number; already: boolean }>> {
  return runAction(async () => {
    const data = answerSchema.parse(input);
    const [row] = await db.select().from(quiz).where(eq(quiz.joinToken, data.joinToken));
    if (!row) throw new UserError("That quiz link doesn't work.");
    const now = new Date();
    if (!answersOpen(row, now)) throw new UserError("Time's up on that question.");

    const player = await currentParticipant(row.id);
    if (!player) throw new UserError("Join the quiz first.");

    const [question] = await db
      .select({ id: quizQuestion.id, options: quizQuestion.options, correctIndex: quizQuestion.correctIndex })
      .from(quizQuestion)
      .where(and(eq(quizQuestion.quizId, row.id), eq(quizQuestion.position, row.currentPosition)));
    if (!question) throw new UserError("No question is on screen.");
    if (data.optionIndex >= question.options.length) throw new UserError("That isn't one of the options.");

    const inserted = await db
      .insert(quizAnswer)
      .values({
        questionId: question.id,
        participantId: player.id,
        optionIndex: data.optionIndex,
        correct: data.optionIndex === question.correctIndex,
        ms: Math.max(0, now.getTime() - (row.questionStartedAt?.getTime() ?? now.getTime())),
      })
      // One answer per question, and no changing it: that is what makes the
      // times worth ranking.
      .onConflictDoNothing()
      .returning({ optionIndex: quizAnswer.optionIndex });

    if (inserted.length) return { optionIndex: inserted[0].optionIndex, already: false };
    // They had already answered, so the choice that stands is their first one,
    // not this one — the screen has to show that, not what they just tapped.
    const [kept] = await db
      .select({ optionIndex: quizAnswer.optionIndex })
      .from(quizAnswer)
      .where(and(eq(quizAnswer.questionId, question.id), eq(quizAnswer.participantId, player.id)));
    return { optionIndex: kept?.optionIndex ?? data.optionIndex, already: true };
  });
}
