import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/page-header";
import { QuizStatusBadge } from "@/components/quiz-status-badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { quizParticipant } from "@/db/schema";
import { quizJoinUrl, quizWithQuestions } from "@/lib/quiz-state";
import { requireCapPage } from "@/lib/session";
import { QuestionsEditor } from "./questions-editor";
import { QuizDetailsForm } from "./quiz-details-form";
import { QuizPlayers } from "./quiz-players";
import { QuizShare } from "./quiz-share";
import { QuizStageButtons } from "./quiz-stage-buttons";

export const metadata: Metadata = { title: "Edit quiz" };

export default async function QuizEditPage({ params }: PageProps<"/admin/quiz/[id]">) {
  await requireCapPage("quiz.manage");
  const { id } = await params;
  const found = await quizWithQuestions(id);
  if (!found) notFound();
  const { quiz: q, questions } = found;

  const [players, joinUrl] = await Promise.all([
    db
      .select({ id: quizParticipant.id, name: quizParticipant.name, memberId: quizParticipant.memberId })
      .from(quizParticipant)
      .where(eq(quizParticipant.quizId, q.id))
      .orderBy(asc(quizParticipant.createdAt)),
    quizJoinUrl(q.joinToken),
  ]);

  const played = q.status === "live" || q.status === "ended";

  return (
    <PageContainer wide>
      <PageHeader
        title={q.name}
        back={{ href: "/admin/quiz", label: "Quiz" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <QuizStatusBadge status={q.status} />
            <span>
              {questions.length} question{questions.length === 1 ? "" : "s"} · {q.secondsPerQuestion}s each ·{" "}
              {players.length} joined
            </span>
          </span>
        }
        actions={
          q.status === "draft" ? null : (
            <Button asChild>
              <Link href={`/admin/quiz/${q.id}/run`}>Host the quiz</Link>
            </Button>
          )
        }
      />

      <div className="space-y-4">
        <QuizShare
          name={q.name}
          joinToken={q.joinToken}
          url={joinUrl}
          status={q.status}
          questionCount={questions.length}
        />

        <QuizStageButtons quizId={q.id} status={q.status} playerCount={players.length} />

        <QuizDetailsForm
          quizId={q.id}
          name={q.name}
          playsOn={q.playsOn}
          secondsPerQuestion={q.secondsPerQuestion}
          lockSeconds={q.status === "live"}
        />

        <QuestionsEditor
          quizId={q.id}
          locked={played}
          questions={questions.map((x) => ({
            text: x.text,
            options: x.options,
            correctIndex: x.correctIndex,
          }))}
        />

        <QuizPlayers players={players} />
      </div>
    </PageContainer>
  );
}
