"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QuizState } from "@/lib/quiz";

/** Fast enough that a reveal feels immediate, slow enough for a room of phones. */
const POLL_MS = 1000;

/**
 * Keeps one screen in step with the quiz. Everybody — the host and every player —
 * reads the same endpoint, so what the room is looking at is decided in one place
 * on the server rather than by each browser's own clock.
 *
 * The countdown is worked out from `msLeft` and how long ago the poll landed, so
 * a late reply makes the bar jump rather than drift.
 */
export function useQuizState(token: string) {
  const [state, setState] = useState<(QuizState & { fetchedAt: number }) | null>(null);
  const [missing, setMissing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const poke = useRef<(() => void) | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;

    /** Only ever one timer pending, however many polls are in the air. */
    const scheduleNext = () => {
      clearTimeout(timer);
      if (!stop) timer = setTimeout(poll, POLL_MS);
    };

    async function poll() {
      try {
        const res = await fetch(`/api/quiz/${token}/state`, { cache: "no-store" });
        if (res.status === 404) {
          setMissing(true);
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data: QuizState = await res.json();
        setState({ ...data, fetchedAt: Date.now() });
        setOffline(false);
      } catch {
        setOffline(true);
      }
      scheduleNext();
    }

    // Asking again right after an answer or a Next tap, instead of waiting out
    // the interval: the screen should move the moment the host does.
    poke.current = () => {
      clearTimeout(timer);
      if (!stop) poll();
    };
    poll();
    const tick = setInterval(() => setNow(Date.now()), 100);
    return () => {
      stop = true;
      poke.current = null;
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [token]);

  const refresh = useCallback(() => poke.current?.(), []);

  const msLeft = state ? Math.max(0, state.msLeft - (now - state.fetchedAt)) : 0;
  const secondsLeft = Math.ceil(msLeft / 1000);
  const fraction = state?.quiz.secondsPerQuestion ? msLeft / (state.quiz.secondsPerQuestion * 1000) : 0;

  return { state, missing, offline, msLeft, secondsLeft, fraction, refresh };
}
