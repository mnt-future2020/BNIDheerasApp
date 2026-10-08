"use client";

import { CheckIcon, ChevronRightIcon, EyeIcon, FlagIcon, MaximizeIcon, PlayIcon, UsersIcon, WifiOffIcon } from "lucide-react";
import QRCode from "qrcode";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { endQuiz, nextQuestion, revealAnswer, startQuiz } from "@/actions/quiz";
import { ConfirmButton } from "@/components/confirm-button";
import {
  FastestList,
  optionLetter,
  QuizCountdown,
  QuizPodium,
  QuizStandingsList,
} from "@/components/quiz/quiz-pieces";
import { useQuizState } from "@/components/quiz/use-quiz-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { quizPodium } from "@/lib/quiz";
import { cn } from "@/lib/utils";

/**
 * The host's screen — the one the room is looking at. It drives the quiz: open
 * the lobby, put the first question up, read out the fastest answers, then on to
 * the next one. Everything it shows comes from the same poll the players read,
 * so the host is never a question ahead of the room.
 */
export function QuizHost({
  quizId,
  name,
  joinToken,
  joinUrl,
  secondsPerQuestion,
}: {
  quizId: string;
  name: string;
  joinToken: string;
  /** The absolute join address, resolved on the server. */
  joinUrl: string;
  secondsPerQuestion: number;
}) {
  const { state, offline, secondsLeft, fraction, refresh } = useQuizState(joinToken);
  const [pending, start] = useTransition();
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(joinUrl, { margin: 1, width: 900, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(null));
  }, [joinUrl]);

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      if (done) toast.success(done);
      refresh();
    });

  const phase = state?.phase;
  const question = state?.question ?? null;
  const players = state?.standings ?? [];
  const lastQuestion = !!question && question.position >= question.total;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/admin/quiz/${quizId}`} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to the quiz
          </Link>
          <h1 className="truncate text-2xl font-bold tracking-tight">{name}</h1>
          <p className="text-sm text-muted-foreground">
            {players.length} joined · {secondsPerQuestion}s a question
            {question ? ` · question ${question.position} of ${question.total}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {offline ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive">
              <WifiOffIcon className="size-4" /> Reconnecting
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            title="Full screen"
            aria-label="Full screen"
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
          >
            <MaximizeIcon />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* ---------------- Lobby ---------------- */}
          {phase === "lobby" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Scan to join</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                {qr ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={qr}
                    alt="QR code to join the quiz"
                    className="w-[min(46vh,320px)] max-w-full rounded-2xl border bg-white p-3"
                  />
                ) : (
                  <div className="size-72 animate-pulse rounded-2xl bg-muted" />
                )}
                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <div>
                    <div className="text-5xl font-bold tabular-nums">{players.length}</div>
                    <div className="text-muted-foreground">in the room</div>
                  </div>
                  <div className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs break-all">{joinUrl}</div>
                  <p className="text-sm text-muted-foreground">
                    Anyone can scan and type a name — no app account needed.
                  </p>
                  <Button
                    size="lg"
                    disabled={pending || players.length === 0}
                    onClick={() => run(() => startQuiz(quizId), "Here we go.")}
                  >
                    <PlayIcon /> Start the quiz
                  </Button>
                  {players.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Waiting for the first person to join.</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* ------------- Question on screen ------------- */}
          {phase === "question" && question ? (
            <Card>
              <CardHeader className="gap-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">
                    Question {question.position} of {question.total}
                  </CardTitle>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {state?.answeredCount ?? 0} of {players.length} answered
                  </span>
                </div>
                <QuizCountdown secondsLeft={secondsLeft} fraction={fraction} />
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-2xl font-semibold">{question.text}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {question.options.map((o, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 text-lg",
                        // The host knows the answer — they are reading it out.
                        i === question.correctIndex ? "border-green-500 bg-green-50" : "bg-card",
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border font-bold">
                        {optionLetter(i)}
                      </span>
                      <span className="min-w-0 flex-1">{o}</span>
                      {i === question.correctIndex ? <CheckIcon className="size-5 text-green-600" /> : null}
                    </div>
                  ))}
                </div>
                <Button variant="outline" disabled={pending} onClick={() => run(() => revealAnswer(quizId))}>
                  <EyeIcon /> Close it now
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {/* ------------- The places on that question ------------- */}
          {phase === "reveal" && question ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Question {question.position}: fastest right answers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-lg font-medium">{question.text}</p>
                <div className="flex items-center gap-3 rounded-xl border border-green-500 bg-green-50 p-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-green-600 bg-green-600 font-bold text-white">
                    {question.correctIndex === null ? "?" : optionLetter(question.correctIndex)}
                  </span>
                  <span className="font-semibold">
                    {question.correctIndex === null ? "—" : question.options[question.correctIndex]}
                  </span>
                </div>
                <FastestList fastest={state?.fastest ?? []} />
                <div className="flex flex-wrap gap-2">
                  <Button size="lg" disabled={pending} onClick={() => run(() => nextQuestion(quizId))}>
                    {lastQuestion ? (
                      <>
                        <FlagIcon /> Show the final places
                      </>
                    ) : (
                      <>
                        <ChevronRightIcon /> Next question
                      </>
                    )}
                  </Button>
                  {lastQuestion ? null : (
                    <ConfirmButton
                      label="Finish early"
                      destructive={false}
                      title="Finish the quiz here?"
                      description="The questions left are skipped and the final places go up."
                      confirmLabel="Finish the quiz"
                      success="Quiz finished."
                      action={() => endQuiz(quizId)}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* ---------------- Final places ---------------- */}
          {phase === "ended" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top {Math.min(3, players.length)} — well played</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <QuizPodium podium={quizPodium(players)} />
                <Button variant="outline" asChild>
                  <Link href={`/admin/quiz/${quizId}`}>Back to the quiz</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {!state ? <div className="h-64 animate-pulse rounded-xl bg-muted" /> : null}
        </div>

        {/* ---------------- The room ---------------- */}
        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UsersIcon className="size-4" />
              {phase === "lobby" ? "Who has joined" : "Leaderboard"}
              <span className="ml-auto font-normal text-muted-foreground tabular-nums">{players.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[60vh] overflow-y-auto">
            <QuizStandingsList standings={players} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
