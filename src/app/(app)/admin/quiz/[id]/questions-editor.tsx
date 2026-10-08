"use client";

import { ChevronDownIcon, ChevronUpIcon, LockIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveQuestions } from "@/actions/quiz";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QUIZ_MAX_OPTIONS, QUIZ_MIN_OPTIONS } from "@/db/schema";
import { cn } from "@/lib/utils";

type Draft = { text: string; options: string[]; correctIndex: number };

const blank = (): Draft => ({ text: "", options: ["", ""], correctIndex: 0 });

/**
 * Writing the quiz: a question, up to four options, and a tick on the right one.
 * Locked once the quiz has been played, because the answers already given were
 * marked against these questions.
 */
export function QuestionsEditor({
  quizId,
  questions,
  locked,
}: {
  quizId: string;
  questions: Draft[];
  locked: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Draft[]>(() => (questions.length ? questions.map((q) => ({ ...q })) : [blank()]));
  const [pending, start] = useTransition();

  const update = (i: number, patch: Partial<Draft>) =>
    setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const setOption = (i: number, oi: number, value: string) =>
    setRows((list) =>
      list.map((r, j) => (j === i ? { ...r, options: r.options.map((o, k) => (k === oi ? value : o)) } : r)),
    );

  const addOption = (i: number) =>
    setRows((list) =>
      list.map((r, j) => (j === i && r.options.length < QUIZ_MAX_OPTIONS ? { ...r, options: [...r.options, ""] } : r)),
    );

  const removeOption = (i: number, oi: number) =>
    setRows((list) =>
      list.map((r, j) => {
        if (j !== i || r.options.length <= QUIZ_MIN_OPTIONS) return r;
        const options = r.options.filter((_, k) => k !== oi);
        // The tick follows the option it was on, and never points past the end.
        const correctIndex =
          r.correctIndex === oi ? 0 : r.correctIndex > oi ? r.correctIndex - 1 : r.correctIndex;
        return { ...r, options, correctIndex };
      }),
    );

  const move = (i: number, by: number) =>
    setRows((list) => {
      const to = i + by;
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      [next[i], next[to]] = [next[to], next[i]];
      return next;
    });

  const save = () =>
    start(async () => {
      const res = await saveQuestions({ quizId, questions: rows });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Saved ${res.data.saved} question${res.data.saved === 1 ? "" : "s"}.`);
      router.refresh();
    });

  const ready = rows.filter((r) => r.text.trim().length >= 3 && r.options.filter((o) => o.trim()).length >= 2).length;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Questions</CardTitle>
        <span className="text-sm text-muted-foreground">
          {locked ? (
            <span className="inline-flex items-center gap-1">
              <LockIcon className="size-3.5" /> Played — reset the quiz to change these
            </span>
          ) : (
            `${ready} of ${rows.length} ready`
          )}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((r, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Question {i + 1}</span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={locked || i === 0}
                  aria-label={`Move question ${i + 1} up`}
                  onClick={() => move(i, -1)}
                >
                  <ChevronUpIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={locked || i === rows.length - 1}
                  aria-label={`Move question ${i + 1} down`}
                  onClick={() => move(i, 1)}
                >
                  <ChevronDownIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={locked || rows.length === 1}
                  aria-label={`Remove question ${i + 1}`}
                  onClick={() => setRows((list) => list.filter((_, j) => j !== i))}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`q-${i}`}>Question</Label>
              <Textarea
                id={`q-${i}`}
                rows={2}
                disabled={locked}
                value={r.text}
                onChange={(e) => update(i, { text: e.target.value })}
                placeholder="e.g. How many Givers Gain® principles does BNI run on?"
              />
            </div>

            <div className="space-y-2">
              <Label>Options — tap the circle to mark the right one</Label>
              {r.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={locked}
                    aria-label={`Mark option ${oi + 1} of question ${i + 1} as the right answer`}
                    aria-pressed={r.correctIndex === oi}
                    onClick={() => update(i, { correctIndex: oi })}
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors disabled:opacity-50",
                      r.correctIndex === oi
                        ? "border-green-600 bg-green-600 text-white"
                        : "border-border text-muted-foreground hover:border-green-600",
                    )}
                  >
                    {String.fromCharCode(65 + oi)}
                  </button>
                  <Input
                    disabled={locked}
                    value={o}
                    onChange={(e) => setOption(i, oi, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={locked || r.options.length <= QUIZ_MIN_OPTIONS}
                    aria-label={`Remove option ${oi + 1} of question ${i + 1}`}
                    onClick={() => removeOption(i, oi)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
              {r.options.length < QUIZ_MAX_OPTIONS && !locked ? (
                <Button type="button" variant="outline" size="sm" onClick={() => addOption(i)}>
                  <PlusIcon /> Add option
                </Button>
              ) : null}
            </div>
          </div>
        ))}

        {locked ? null : (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setRows((list) => [...list, blank()])}>
              <PlusIcon /> Add question
            </Button>
            <Button className="ml-auto" disabled={pending || ready === 0} onClick={save}>
              Save questions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
