"use client";

import { CheckIcon, LoaderCircleIcon, WifiOffIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { answerQuestion, joinQuiz } from "@/actions/quiz";
import { BrandLogo } from "@/components/brand-logo";
import {
  FastestList,
  optionLetter,
  QuizCountdown,
  QuizPodium,
  QuizStandingsList,
} from "@/components/quiz/quiz-pieces";
import { useQuizState } from "@/components/quiz/use-quiz-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAnswerTime, ordinal, quizPodium } from "@/lib/quiz";
import { cn } from "@/lib/utils";

/**
 * A player's phone. One thing on screen at a time: type your name, wait, answer,
 * see where you came. The options stop taking taps the moment the clock runs out
 * locally, so a tap that can't win doesn't look like it was accepted — the server
 * checks the time again anyway.
 */
export function QuizPlayer({
  joinToken,
  quizName,
  joined: joinedOnLoad,
  suggestedName,
}: {
  joinToken: string;
  quizName: string;
  joined: boolean;
  suggestedName: string;
}) {
  const { state, missing, offline, msLeft, secondsLeft, fraction, refresh } = useQuizState(joinToken);
  const [name, setName] = useState(suggestedName);
  const [joined, setJoined] = useState(joinedOnLoad);
  const [pending, start] = useTransition();
  /** Shown the instant they tap, before the poll confirms it. */
  const [tapped, setTapped] = useState<{ position: number; optionIndex: number } | null>(null);

  const phase = state?.phase;
  const question = state?.question ?? null;
  const me = state?.me ?? null;

  const join = () =>
    start(async () => {
      const res = await joinQuiz({ joinToken, name });
      if (!res.ok) return void toast.error(res.error);
      setJoined(true);
      setName(res.data.name);
      toast.success(`You're in, ${res.data.name.split(" ")[0]}.`);
      refresh();
    });

  const answer = (optionIndex: number) => {
    if (!question) return;
    setTapped({ position: question.position, optionIndex });
    start(async () => {
      const res = await answerQuestion({ joinToken, optionIndex });
      if (!res.ok) {
        setTapped(null);
        return void toast.error(res.error);
      }
      // What stands is their first tap, which may not be this one.
      setTapped({ position: question.position, optionIndex: res.data.optionIndex });
      refresh();
    });
  };

  // The tap shows straight away; the poll confirms it a moment later. A tap left
  // over from an earlier question simply doesn't match, so it never shows.
  const optimistic = tapped && question && tapped.position === question.position ? tapped.optionIndex : null;
  const myAnswer = me?.answeredIndex ?? optimistic;
  const answered = myAnswer !== null;
  const closed = msLeft <= 0;
  const myPlace = state?.standings.find((s) => s.participantId === me?.id);
  const myFastest = state?.fastest?.find((f) => f.name === me?.name);

  if (missing) {
    return (
      <Shell quizName="Quiz">
        <Panel title="That link doesn't work">
          <p className="text-muted-foreground">
            Check the link you were sent, or ask whoever is running the quiz for a fresh one.
          </p>
        </Panel>
      </Shell>
    );
  }

  return (
    <Shell quizName={state?.quiz.name ?? quizName}>
      {offline ? (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive">
          <WifiOffIcon className="size-4" /> Lost the signal — trying again
        </div>
      ) : null}

      {/* ---------------- Not in yet ---------------- */}
      {!joined || !me ? (
        <Panel title={state?.quiz.status === "draft" ? "Not open yet" : "Join the quiz"}>
          {state?.quiz.status === "draft" ? (
            <p className="text-muted-foreground">
              The quiz hasn&apos;t been opened. Keep this page open — it starts working the moment the host opens it.
            </p>
          ) : state?.quiz.status === "ended" ? (
            <p className="text-muted-foreground">This quiz has finished.</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="player-name">Your name</Label>
                <Input
                  id="player-name"
                  value={name}
                  autoComplete="name"
                  placeholder="e.g. Ravi Kumar"
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim().length >= 2) join();
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  This is the name the room sees on the leaderboard.
                </p>
              </div>
              <Button className="w-full" size="lg" disabled={pending || name.trim().length < 2} onClick={join}>
                {pending ? <LoaderCircleIcon className="animate-spin" /> : null} Join the quiz
              </Button>
            </div>
          )}
        </Panel>
      ) : null}

      {/* ---------------- In, waiting for the host ---------------- */}
      {joined && me && phase === "lobby" ? (
        <Panel title={`You're in, ${me.name.split(" ")[0]}`}>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Waiting for the host to start. Keep this page open — the first question appears here.
            </p>
            <div>
              <div className="text-4xl font-bold tabular-nums">{state?.standings.length ?? 1}</div>
              <div className="text-sm text-muted-foreground">in the room</div>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium">Who&apos;s here</div>
              <QuizStandingsList standings={state?.standings ?? []} highlightName={me.name} limit={12} />
            </div>
          </div>
        </Panel>
      ) : null}

      {/* ---------------- A question ---------------- */}
      {joined && me && phase === "question" && question ? (
        <Panel
          title={`Question ${question.position} of ${question.total}`}
          aside={<span className="text-sm text-muted-foreground">{state?.quiz.secondsPerQuestion}s</span>}
        >
          <div className="space-y-4">
            <QuizCountdown secondsLeft={secondsLeft} fraction={fraction} />
            <p className="text-xl font-semibold">{question.text}</p>
            <div className="grid gap-2">
              {question.options.map((o, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={answered || closed || pending}
                  onClick={() => answer(i)}
                  aria-pressed={myAnswer === i}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-4 text-left text-lg transition-colors",
                    myAnswer === i ? "border-primary bg-primary/10 font-semibold" : "bg-card",
                    answered || closed ? "opacity-70" : "hover:border-primary/50 active:translate-y-px",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border font-bold">
                    {optionLetter(i)}
                  </span>
                  <span className="min-w-0 flex-1">{o}</span>
                  {myAnswer === i ? <CheckIcon className="size-5 text-primary" /> : null}
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {answered
                ? "Locked in. The quicker you were, the higher you place."
                : closed
                  ? "Time's up on this one."
                  : "Tap an answer — you only get one."}
            </p>
          </div>
        </Panel>
      ) : null}

      {/* ---------------- How that question went ---------------- */}
      {joined && me && phase === "reveal" && question ? (
        <Panel title={`Question ${question.position}`}>
          <div className="space-y-4">
            <div
              className={cn(
                "rounded-xl border p-4 text-center",
                me.answeredCorrect
                  ? "border-green-500 bg-green-50 text-green-900"
                  : myAnswer !== null
                    ? "border-destructive/40 bg-destructive/5"
                    : "bg-muted/40",
              )}
            >
              <div className="flex items-center justify-center gap-2 text-lg font-bold">
                {me.answeredCorrect ? (
                  <>
                    <CheckIcon className="size-5" /> Right
                    {myFastest ? ` — ${ordinal(myFastest.rank)} fastest` : ""}
                  </>
                ) : myAnswer !== null ? (
                  <>
                    <XIcon className="size-5" /> Not that one
                  </>
                ) : (
                  "You didn't answer in time"
                )}
              </div>
              {me.answeredMs !== null ? (
                <div className="text-sm opacity-80">You took {formatAnswerTime(me.answeredMs)}</div>
              ) : null}
            </div>

            <div>
              <div className="mb-1.5 text-sm font-medium">The answer</div>
              <div className="flex items-center gap-3 rounded-xl border border-green-500 bg-green-50 p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-green-600 bg-green-600 font-bold text-white">
                  {question.correctIndex === null ? "?" : optionLetter(question.correctIndex)}
                </span>
                <span className="font-semibold">
                  {question.correctIndex === null ? "—" : question.options[question.correctIndex]}
                </span>
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-sm font-medium">Fastest on this question</div>
              <FastestList fastest={state?.fastest ?? []} highlightName={me.name} />
            </div>

            {myPlace ? (
              <p className="text-center text-sm text-muted-foreground">
                You&apos;re {ordinal(myPlace.rank)} overall with {myPlace.correct} right.
              </p>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {/* ---------------- The end ---------------- */}
      {joined && me && phase === "ended" ? (
        <Panel title="Top 3">
          <div className="space-y-4">
            <QuizPodium podium={quizPodium(state?.standings ?? [])} highlightName={me.name} />
            {myPlace ? (
              <p className="text-center font-medium">
                {myPlace.rank <= 3
                  ? "That's you on the podium — well played."
                  : `You finished ${ordinal(myPlace.rank)} with ${myPlace.correct} right.`}
              </p>
            ) : null}
            <div>
              <div className="mb-1.5 text-sm font-medium">Everyone</div>
              <QuizStandingsList standings={state?.standings ?? []} highlightName={me.name} />
            </div>
          </div>
        </Panel>
      ) : null}

      {!state ? <div className="h-48 animate-pulse rounded-2xl bg-muted" /> : null}
    </Shell>
  );
}

/** The page around the panel: the chapter's logo and the quiz's name. */
function Shell({ quizName, children }: { quizName: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
        <div className="text-center">
          <BrandLogo height={48} preload className="mx-auto mb-2" />
          <h1 className="text-xl font-bold tracking-tight">{quizName}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}

function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
