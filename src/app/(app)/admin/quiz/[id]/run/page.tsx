import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { quiz } from "@/db/schema";
import { quizJoinUrl } from "@/lib/quiz-state";
import { requireCapPage } from "@/lib/session";
import { QuizHost } from "./quiz-host";

export const metadata: Metadata = { title: "Host quiz" };

export default async function QuizRunPage({ params }: PageProps<"/admin/quiz/[id]/run">) {
  await requireCapPage("quiz.manage");
  const { id } = await params;
  const [row] = await db.select().from(quiz).where(eq(quiz.id, id));
  if (!row) notFound();
  // Nothing to host while it is still being written, and the editor is where
  // the "Open for joining" button lives.
  if (row.status === "draft") redirect(`/admin/quiz/${row.id}`);

  return (
    <QuizHost
      quizId={row.id}
      name={row.name}
      joinToken={row.joinToken}
      joinUrl={await quizJoinUrl(row.joinToken)}
      secondsPerQuestion={row.secondsPerQuestion}
    />
  );
}
