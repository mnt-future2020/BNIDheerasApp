import { desc, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { quiz, quizParticipant, quizQuestion } from "@/db/schema";
import { requireCapPage } from "@/lib/session";
import { toIstDateInput } from "@/lib/time";
import { QuizList } from "./quiz-list";

export const metadata: Metadata = { title: "Quiz" };

export default async function QuizAdminPage() {
  await requireCapPage("quiz.manage");

  const rows = await db
    .select({
      id: quiz.id,
      name: quiz.name,
      playsOn: quiz.playsOn,
      status: quiz.status,
      secondsPerQuestion: quiz.secondsPerQuestion,
      questions: sql<number>`(select count(*)::int from ${quizQuestion} where ${quizQuestion.quizId} = ${quiz.id})`,
      players: sql<number>`(select count(*)::int from ${quizParticipant} where ${quizParticipant.quizId} = ${quiz.id})`,
    })
    .from(quiz)
    // The one being played is the one wanted now, so the newest date leads.
    .orderBy(desc(quiz.playsOn), desc(quiz.createdAt));

  return (
    <PageContainer wide>
      <PageHeader
        title="Quiz"
        back={{ href: "/admin", label: "Admin" }}
        description="Write a quiz for the feature presentation slot, send round its QR, and host it live while the room answers on their phones."
      />
      <QuizList quizzes={rows} today={toIstDateInput(new Date())} />
    </PageContainer>
  );
}
