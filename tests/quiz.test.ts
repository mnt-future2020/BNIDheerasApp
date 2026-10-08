import { describe, expect, it } from "vitest";
import { QUIZ_SECONDS_DEFAULT, type QuizStatus } from "@/db/schema";
import {
  ANSWER_GRACE_MS,
  answersOpen,
  formatAnswerTime,
  joinOpen,
  msLeft,
  ordinal,
  questionEndsAt,
  questionRanking,
  quizLeaderboard,
  quizPhase,
  quizPodium,
  type QuizTiming,
} from "@/lib/quiz";

const UP_AT = new Date("2026-10-08T07:30:00.000Z");
const at = (msAfterQuestionStart: number) => new Date(UP_AT.getTime() + msAfterQuestionStart);

const timing = (patch: Partial<QuizTiming> = {}): QuizTiming => ({
  status: "live" as QuizStatus,
  currentPosition: 1,
  questionStartedAt: UP_AT,
  questionEndedAt: null,
  secondsPerQuestion: QUIZ_SECONDS_DEFAULT,
  ...patch,
});

describe("quiz timing", () => {
  it("closes a question eight seconds after it goes up", () => {
    expect(questionEndsAt(timing())).toEqual(at(8000));
    expect(msLeft(timing(), at(0))).toBe(8000);
    expect(msLeft(timing(), at(5500))).toBe(2500);
    // Never negative: the countdown sits at zero rather than going backwards.
    expect(msLeft(timing(), at(99_000))).toBe(0);
  });

  it("lets the host close a question early, but never extend one", () => {
    expect(questionEndsAt(timing({ questionEndedAt: at(3000) }))).toEqual(at(3000));
    // A stamp after the window would hand out extra time; the window still wins.
    expect(questionEndsAt(timing({ questionEndedAt: at(20_000) }))).toEqual(at(8000));
  });

  it("reads the room's phase from the clock, not from the host pressing anything", () => {
    expect(quizPhase(timing({ status: "draft" }), at(0))).toBe("draft");
    expect(quizPhase(timing({ status: "open", currentPosition: 0 }), at(0))).toBe("lobby");
    // Live but still before the first question: that is the lobby too.
    expect(quizPhase(timing({ currentPosition: 0 }), at(0))).toBe("lobby");
    expect(quizPhase(timing(), at(1000))).toBe("question");
    expect(quizPhase(timing(), at(7999))).toBe("question");
    // The eight seconds run out on their own and the answer is revealed.
    expect(quizPhase(timing(), at(8000))).toBe("reveal");
    expect(quizPhase(timing({ questionEndedAt: at(2000) }), at(2500))).toBe("reveal");
    expect(quizPhase(timing({ status: "ended" }), at(1000))).toBe("ended");
  });

  it("takes an answer that lands a moment late, and nothing beyond that", () => {
    expect(answersOpen(timing(), at(7999))).toBe(true);
    expect(answersOpen(timing(), at(8000))).toBe(true);
    expect(answersOpen(timing(), at(8000 + ANSWER_GRACE_MS))).toBe(true);
    expect(answersOpen(timing(), at(8000 + ANSWER_GRACE_MS + 1))).toBe(false);
    // Nothing is open in the lobby, in a draft or after the quiz has finished.
    expect(answersOpen(timing({ currentPosition: 0 }), at(100))).toBe(false);
    expect(answersOpen(timing({ status: "open" }), at(100))).toBe(false);
    expect(answersOpen(timing({ status: "ended" }), at(100))).toBe(false);
  });

  it("lets people join the lobby and latecomers join mid-quiz, but not a draft", () => {
    expect(joinOpen("draft")).toBe(false);
    expect(joinOpen("open")).toBe(true);
    expect(joinOpen("live")).toBe(true);
    expect(joinOpen("ended")).toBe(false);
  });
});

describe("the places on one question", () => {
  it("orders the right answers by who was quickest", () => {
    const ranked = questionRanking([
      { participantId: "c", correct: true, ms: 3200 },
      { participantId: "a", correct: true, ms: 900 },
      { participantId: "b", correct: true, ms: 1500 },
    ]);
    expect(ranked.map((r) => r.participantId)).toEqual(["a", "b", "c"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("gives a wrong answer no place, however fast it was", () => {
    const ranked = questionRanking([
      { participantId: "quick-but-wrong", correct: false, ms: 120 },
      { participantId: "right", correct: true, ms: 5000 },
    ]);
    expect(ranked).toEqual([{ participantId: "right", ms: 5000, rank: 1 }]);
  });

  it("shares a place between two taps in the same millisecond", () => {
    const ranked = questionRanking([
      { participantId: "a", correct: true, ms: 1000 },
      { participantId: "b", correct: true, ms: 1000 },
      { participantId: "c", correct: true, ms: 2000 },
    ]);
    // Two firsts, then third — not first, second, third.
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("shows five names, and counts a shared place as one of them", () => {
    const answers = Array.from({ length: 9 }, (_, i) => ({
      participantId: `p${i}`,
      correct: true,
      ms: (i + 1) * 100,
    }));
    expect(questionRanking(answers)).toHaveLength(5);
    expect(questionRanking(answers).at(-1)?.rank).toBe(5);
  });

  it("says nothing rather than something wrong when nobody got it", () => {
    expect(questionRanking([{ participantId: "a", correct: false, ms: 10 }])).toEqual([]);
  });
});

describe("the leaderboard", () => {
  const players = [
    { id: "asha", name: "Asha" },
    { id: "bala", name: "Bala" },
    { id: "chitra", name: "Chitra" },
  ];

  it("ranks on right answers first, then on the time they took over them", () => {
    const standings = quizLeaderboard(players, [
      { participantId: "asha", correct: true, ms: 4000 },
      { participantId: "asha", correct: true, ms: 4000 },
      { participantId: "bala", correct: true, ms: 1000 },
      { participantId: "bala", correct: true, ms: 1000 },
      { participantId: "chitra", correct: true, ms: 100 },
    ]);
    // Bala and Asha both got two; Bala was quicker over them. Chitra's single
    // very fast answer doesn't buy her a place above either of them.
    expect(standings.map((s) => s.name)).toEqual(["Bala", "Asha", "Chitra"]);
    expect(standings.map((s) => s.rank)).toEqual([1, 2, 3]);
    expect(standings[0]).toMatchObject({ correct: 2, totalMs: 2000 });
  });

  it("ignores the time spent on a wrong answer", () => {
    // Otherwise guessing instantly and wrongly would improve a total.
    const standings = quizLeaderboard(players.slice(0, 2), [
      { participantId: "asha", correct: true, ms: 2000 },
      { participantId: "asha", correct: false, ms: 10 },
      { participantId: "bala", correct: true, ms: 2000 },
    ]);
    expect(standings.map((s) => s.totalMs)).toEqual([2000, 2000]);
    // Dead level on both counts, so they share the place.
    expect(standings.map((s) => s.rank)).toEqual([1, 1]);
  });

  it("lists everyone who joined, so the host's screen is also the register", () => {
    const standings = quizLeaderboard(players, []);
    expect(standings).toHaveLength(3);
    expect(standings.every((s) => s.correct === 0 && s.totalMs === 0)).toBe(true);
    // Nothing to separate them yet, so nobody is put above anybody.
    expect(standings.map((s) => s.rank)).toEqual([1, 1, 1]);
  });

  it("keeps an answer from somebody who has left out of the standings", () => {
    const standings = quizLeaderboard([{ id: "asha", name: "Asha" }], [
      { participantId: "asha", correct: true, ms: 500 },
      { participantId: "removed-player", correct: true, ms: 10 },
    ]);
    expect(standings).toHaveLength(1);
    expect(standings[0]).toMatchObject({ name: "Asha", correct: 1 });
  });
});

describe("the podium", () => {
  it("takes the top three", () => {
    const standings = quizLeaderboard(
      [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
        { id: "d", name: "D" },
      ],
      [
        { participantId: "a", correct: true, ms: 100 },
        { participantId: "b", correct: true, ms: 200 },
        { participantId: "c", correct: true, ms: 300 },
        { participantId: "d", correct: true, ms: 400 },
      ],
    );
    expect(quizPodium(standings).map((s) => s.name)).toEqual(["A", "B", "C"]);
  });

  it("leaves off anybody who answered nothing right", () => {
    // Three names with a zero beside them would read as a win.
    const standings = quizLeaderboard(
      [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
      ],
      [{ participantId: "a", correct: true, ms: 100 }],
    );
    expect(quizPodium(standings).map((s) => s.name)).toEqual(["A"]);
    expect(quizPodium(quizLeaderboard([{ id: "a", name: "A" }], []))).toEqual([]);
  });

  it("can seat more than three when places are shared", () => {
    const standings = quizLeaderboard(
      [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
      ],
      [
        { participantId: "a", correct: true, ms: 100 },
        { participantId: "b", correct: true, ms: 100 },
        { participantId: "c", correct: true, ms: 100 },
      ],
    );
    // All three level on first: nobody is pushed off the podium they tied for.
    expect(standings.map((s) => s.rank)).toEqual([1, 1, 1]);
    expect(quizPodium(standings)).toHaveLength(3);
  });
});

describe("reading the numbers out", () => {
  it("shows an answer time to one decimal", () => {
    expect(formatAnswerTime(0)).toBe("0.0s");
    expect(formatAnswerTime(1449)).toBe("1.4s");
    expect(formatAnswerTime(8000)).toBe("8.0s");
  });

  it("names a place", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
    ]);
  });
});
