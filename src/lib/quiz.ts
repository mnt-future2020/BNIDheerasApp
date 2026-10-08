import {
  QUIZ_FINAL_WINNERS,
  QUIZ_QUESTION_WINNERS,
  type QuizStatus,
} from "@/db/schema";

/**
 * The rules of the live quiz, kept away from the database so they can be read
 * and tested on their own. Everything here is pure: the clock is passed in.
 */

/**
 * What the room is looking at.
 *  - `draft`    the quiz is still being written; the join link does nothing.
 *  - `lobby`    the QR is up and people are joining.
 *  - `question` a question is on screen and answers are being taken.
 *  - `reveal`   its time is up: the right answer and the fastest five.
 *  - `ended`    the final places.
 */
export type QuizPhase = "draft" | "lobby" | "question" | "reveal" | "ended";

/**
 * A tap that lands just after the buzzer still counts. Phones are on hotel
 * wifi, and losing an answer because a packet took 300 ms reads as the app
 * being broken. It can't win anything: it is ranked by its true time, which
 * is slower than everyone who answered inside the window.
 */
export const ANSWER_GRACE_MS = 750;

/** The clock the server scores by: enough of a quiz row to time its question. */
export type QuizTiming = {
  status: QuizStatus;
  currentPosition: number;
  questionStartedAt: Date | null;
  questionEndedAt: Date | null;
  secondsPerQuestion: number;
};

/**
 * When the current question stops taking answers. A question closes on its own
 * after `secondsPerQuestion`; `questionEndedAt` only ever brings that forward,
 * which is the host revealing the answer early.
 */
export function questionEndsAt(q: QuizTiming): Date | null {
  if (!q.questionStartedAt) return null;
  const auto = q.questionStartedAt.getTime() + q.secondsPerQuestion * 1000;
  const early = q.questionEndedAt?.getTime();
  return new Date(early !== undefined && early < auto ? early : auto);
}

export function quizPhase(q: QuizTiming, now: Date): QuizPhase {
  if (q.status === "draft") return "draft";
  if (q.status === "ended") return "ended";
  if (q.status === "open" || q.currentPosition < 1) return "lobby";
  const end = questionEndsAt(q);
  return end && now.getTime() < end.getTime() ? "question" : "reveal";
}

/** Milliseconds left on the question, for the countdown. 0 once it has closed. */
export function msLeft(q: QuizTiming, now: Date): number {
  const end = questionEndsAt(q);
  return end ? Math.max(0, end.getTime() - now.getTime()) : 0;
}

/** True while an answer to the current question can still be taken. */
export function answersOpen(q: QuizTiming, now: Date): boolean {
  if (q.status !== "live" || q.currentPosition < 1) return false;
  const end = questionEndsAt(q);
  return !!end && now.getTime() <= end.getTime() + ANSWER_GRACE_MS;
}

/** The player is in the lobby or a quiz that has finished: joining is still fine. */
export function joinOpen(status: QuizStatus): boolean {
  return status === "open" || status === "live";
}

export type QuizAnswerRow = { participantId: string; correct: boolean; ms: number };

export type QuizRank = { participantId: string; ms: number; rank: number };

/**
 * The fastest right answers to one question, in order — the 1, 2, 3 the room
 * sees. A wrong answer doesn't place at all, however quick it was.
 *
 * Two taps can land in the same millisecond, so places are shared the way they
 * are in a race: two firsts, then third.
 */
export function questionRanking(answers: readonly QuizAnswerRow[], limit = QUIZ_QUESTION_WINNERS): QuizRank[] {
  const right = answers
    .filter((a) => a.correct)
    .toSorted((a, b) => a.ms - b.ms || a.participantId.localeCompare(b.participantId));
  const ranked: QuizRank[] = [];
  right.forEach((a, i) => {
    const tied = i > 0 && right[i - 1].ms === a.ms;
    ranked.push({ participantId: a.participantId, ms: a.ms, rank: tied ? ranked[i - 1].rank : i + 1 });
  });
  // Sliced after ranking, so a shared place doesn't push the list off by one.
  return ranked.slice(0, limit);
}

export type QuizStanding = {
  participantId: string;
  name: string;
  /** Questions answered right. */
  correct: number;
  /** Total time taken over those right answers: the tie-breaker, not a score. */
  totalMs: number;
  rank: number;
};

/**
 * The leaderboard: most right answers first, and between two people on the same
 * number, whoever took less time over them. Time on a wrong answer is ignored —
 * it would otherwise reward guessing early.
 *
 * Everyone who joined is listed, including those yet to answer anything, so the
 * host's screen is also the register of who is in the room.
 */
export function quizLeaderboard(
  participants: readonly { id: string; name: string }[],
  answers: readonly QuizAnswerRow[],
): QuizStanding[] {
  const tally = new Map<string, { correct: number; totalMs: number }>();
  for (const a of answers) {
    if (!a.correct) continue;
    const row = tally.get(a.participantId) ?? { correct: 0, totalMs: 0 };
    row.correct += 1;
    row.totalMs += a.ms;
    tally.set(a.participantId, row);
  }
  const standings = participants
    .map((p) => {
      const t = tally.get(p.id) ?? { correct: 0, totalMs: 0 };
      return { participantId: p.id, name: p.name, correct: t.correct, totalMs: t.totalMs, rank: 0 };
    })
    .toSorted((a, b) => b.correct - a.correct || a.totalMs - b.totalMs || a.name.localeCompare(b.name));
  standings.forEach((s, i) => {
    const previous = standings[i - 1];
    const tied = i > 0 && previous.correct === s.correct && previous.totalMs === s.totalMs;
    s.rank = tied ? previous.rank : i + 1;
  });
  return standings;
}

/**
 * The podium at the end. Nobody who answered nothing right is on it: three
 * names with a zero beside them would read as a win.
 */
export function quizPodium(standings: readonly QuizStanding[], limit = QUIZ_FINAL_WINNERS): QuizStanding[] {
  return standings.filter((s) => s.correct > 0 && s.rank <= limit);
}

/* ------------------------------------------------------------------ */
/* What a screen is sent on each poll                                  */
/* ------------------------------------------------------------------ */

/*
 * These live here, rather than beside the query that builds them, so the host
 * and player screens can read the shape without importing server-only code.
 */

export type QuizStateQuestion = {
  position: number;
  /** How many questions in all, for "Question 3 of 10". */
  total: number;
  text: string;
  options: string[];
  /** Held back from players until the question closes; the host always has it. */
  correctIndex: number | null;
};

export type QuizFastest = { rank: number; name: string; ms: number };

export type QuizState = {
  quiz: {
    id: string;
    name: string;
    playsOn: string;
    status: QuizStatus;
    secondsPerQuestion: number;
    questionCount: number;
  };
  phase: QuizPhase;
  /** Milliseconds left on the question when this was built. The client ages it. */
  msLeft: number;
  /** Who this browser is, and what they did with the question on screen. */
  me: {
    id: string;
    name: string;
    /** Their choice on the current question, or null if they haven't tapped. */
    answeredIndex: number | null;
    answeredMs: number | null;
    /** Only told once the question has closed. */
    answeredCorrect: boolean | null;
  } | null;
  question: QuizStateQuestion | null;
  /** On a reveal: the fastest right answers to the question just closed. */
  fastest: QuizFastest[] | null;
  /** Everyone who joined, in leaderboard order — and so also the register. */
  standings: QuizStanding[];
  /** Host-only: how many have answered the question on screen. */
  answeredCount: number | null;
  isHost: boolean;
};

/** "1.4s" — answer times are read out loud, so one decimal is plenty. */
export function formatAnswerTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** 1st, 2nd, 3rd, 4th. */
export function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}
