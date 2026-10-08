import { CrownIcon } from "lucide-react";
import { formatAnswerTime, ordinal, type QuizFastest, type QuizStanding } from "@/lib/quiz";
import { cn } from "@/lib/utils";

/**
 * The parts of a quiz screen the host and the players both show: the countdown,
 * the fastest answers to a question, the podium and the full leaderboard.
 */

/** A, B, C, D — how an option is called when it is read out. */
export const optionLetter = (i: number) => String.fromCharCode(65 + i);

export function QuizCountdown({ secondsLeft, fraction }: { secondsLeft: number; fraction: number }) {
  // Under three seconds the bar turns, which is the cue to hurry up.
  const hurry = secondsLeft <= 3;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-[width] duration-100", hurry ? "bg-destructive" : "bg-primary")}
          style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }}
        />
      </div>
      <span
        className={cn("w-10 text-right text-lg font-bold tabular-nums", hurry ? "text-destructive" : "text-foreground")}
      >
        {secondsLeft}
      </span>
    </div>
  );
}

const PLACE_STYLES = [
  "bg-amber-100 text-amber-900 border-amber-300",
  "bg-slate-100 text-slate-700 border-slate-300",
  "bg-orange-100 text-orange-900 border-orange-300",
];

/** The place a name holds, coloured for the first three. */
export function PlaceChip({ rank, className }: { rank: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
        PLACE_STYLES[rank - 1] ?? "bg-muted text-muted-foreground border-border",
        className,
      )}
    >
      {rank}
    </span>
  );
}

/**
 * Who answered this question right, fastest first. Nobody getting it right is a
 * real outcome and worth saying out loud, not an empty box.
 */
export function FastestList({ fastest, highlightName }: { fastest: QuizFastest[]; highlightName?: string }) {
  if (fastest.length === 0) {
    return <p className="text-sm text-muted-foreground">Nobody got that one. It stays on the board.</p>;
  }
  return (
    <ol className="space-y-1.5">
      {fastest.map((f, i) => (
        <li
          key={`${f.rank}-${f.name}-${i}`}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-3 py-2",
            f.name === highlightName ? "border-primary/40 bg-primary/5" : "bg-card",
          )}
        >
          <PlaceChip rank={f.rank} />
          <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
          <span className="text-sm text-muted-foreground tabular-nums">{formatAnswerTime(f.ms)}</span>
        </li>
      ))}
    </ol>
  );
}

/** The top three at the end, with the winner raised above the other two. */
export function QuizPodium({ podium, highlightName }: { podium: QuizStanding[]; highlightName?: string }) {
  if (podium.length === 0) {
    return (
      <p className="text-center text-muted-foreground">
        Nobody answered a question right, so there is no podium this time.
      </p>
    );
  }
  return (
    <ol className="space-y-2">
      {podium.map((s) => (
        <li
          key={s.participantId}
          className={cn(
            "flex items-center gap-3 rounded-2xl border p-4",
            s.rank === 1 ? "border-amber-300 bg-amber-50" : "bg-card",
            s.name === highlightName ? "ring-2 ring-primary/40" : "",
          )}
        >
          <PlaceChip rank={s.rank} className="size-9 text-base" />
          <div className="min-w-0 flex-1">
            <div className={cn("truncate font-bold", s.rank === 1 ? "text-xl" : "text-lg")}>
              {s.name}
              {s.rank === 1 ? <CrownIcon className="ml-1.5 inline size-4 text-amber-600" /> : null}
            </div>
            <div className="text-sm text-muted-foreground">
              {ordinal(s.rank)} · {s.correct} right · {formatAnswerTime(s.totalMs)} in all
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Everyone, in order. Doubles as the register of who is in the room. */
export function QuizStandingsList({
  standings,
  highlightName,
  limit,
}: {
  standings: QuizStanding[];
  highlightName?: string;
  limit?: number;
}) {
  const shown = limit ? standings.slice(0, limit) : standings;
  if (shown.length === 0) {
    return <p className="text-sm text-muted-foreground">Nobody has joined yet.</p>;
  }
  return (
    <ul className="space-y-1">
      {shown.map((s) => (
        <li
          key={s.participantId}
          className={cn(
            "flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-sm",
            s.name === highlightName ? "bg-primary/5 font-medium" : "",
          )}
        >
          <span className="w-6 text-right text-muted-foreground tabular-nums">{s.rank}</span>
          <span className="min-w-0 flex-1 truncate">{s.name}</span>
          <span className="tabular-nums">{s.correct}</span>
          {s.correct > 0 ? (
            <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">
              {formatAnswerTime(s.totalMs)}
            </span>
          ) : (
            <span className="w-14" />
          )}
        </li>
      ))}
      {limit && standings.length > limit ? (
        <li className="px-2.5 pt-1 text-xs text-muted-foreground">and {standings.length - limit} more</li>
      ) : null}
    </ul>
  );
}
