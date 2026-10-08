import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { quiz } from "@/db/schema";
import { currentParticipant } from "@/lib/quiz-state";
import { getCurrentMember } from "@/lib/session";
import { QuizPlayer } from "./quiz-player";

export const metadata: Metadata = { title: "Quiz" };

/**
 * Playing a quiz. Outside the signed-in part of the app on purpose: a visitor
 * gets this link on WhatsApp, taps it, types a name and plays.
 */
export default async function QuizPlayPage({ params }: PageProps<"/quiz/[token]">) {
  const { token } = await params;
  const [row] = await db.select({ id: quiz.id, name: quiz.name }).from(quiz).where(eq(quiz.joinToken, token));
  if (!row) notFound();

  const [me, player] = await Promise.all([getCurrentMember(), currentParticipant(row.id)]);

  return (
    <QuizPlayer
      joinToken={token}
      quizName={row.name}
      joined={!!player}
      // A member playing from inside the app shouldn't have to type their name.
      suggestedName={player?.name ?? me?.fullName ?? ""}
    />
  );
}
