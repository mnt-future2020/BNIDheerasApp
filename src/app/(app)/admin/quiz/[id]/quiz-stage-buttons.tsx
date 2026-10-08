"use client";

import { DoorOpenIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { openQuiz, resetQuiz } from "@/actions/quiz";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { QuizStatus } from "@/db/schema";

/**
 * Moving the quiz between its stages. Starting the first question happens on the
 * host screen, with the room watching — not from here.
 */
export function QuizStageButtons({
  quizId,
  status,
  playerCount,
}: {
  quizId: string;
  status: QuizStatus;
  playerCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const open = () =>
    start(async () => {
      const res = await openQuiz(quizId);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Open for joining. Share the QR and the link.");
      router.refresh();
    });

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 py-4">
        {status === "draft" ? (
          <>
            <Button disabled={pending} onClick={open}>
              <DoorOpenIcon /> Open for joining
            </Button>
            <p className="text-sm text-muted-foreground">
              The link and QR start working, and names appear as people join.
            </p>
          </>
        ) : null}

        {status === "open" || status === "live" ? (
          <>
            <Button asChild>
              <Link href={`/admin/quiz/${quizId}/run`}>
                {status === "live" ? "Back to hosting" : "Host the quiz"}
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              {playerCount} joined so far. The host screen runs the questions and shows the places.
            </p>
          </>
        ) : null}

        {status === "ended" ? (
          <>
            <Button variant="outline" asChild>
              <Link href={`/admin/quiz/${quizId}/run`}>See the final places</Link>
            </Button>
            <p className="text-sm text-muted-foreground">Played by {playerCount}.</p>
          </>
        ) : null}

        {status === "draft" && playerCount === 0 ? null : (
          <ConfirmButton
            className="ml-auto"
            label="Reset"
            icon={<RotateCcwIcon />}
            title="Reset this quiz?"
            description={
              <>
                Everyone who joined and every answer they gave are cleared, and the quiz goes back to a draft. The
                questions stay. Use this to rehearse, or to play the same quiz again.
              </>
            }
            confirmLabel="Reset quiz"
            success="Quiz reset. The questions are still here."
            action={() => resetQuiz(quizId)}
          />
        )}
      </CardContent>
    </Card>
  );
}
