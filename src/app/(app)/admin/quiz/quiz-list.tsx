"use client";

import { PencilIcon, PlayIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createQuiz, deleteQuiz } from "@/actions/quiz";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState } from "@/components/page-header";
import { QuizStatusBadge } from "@/components/quiz-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QUIZ_SECONDS_DEFAULT, QUIZ_SECONDS_MAX, QUIZ_SECONDS_MIN, type QuizStatus } from "@/db/schema";
import { formatDate, istToDate } from "@/lib/time";

type Row = {
  id: string;
  name: string;
  playsOn: string;
  status: QuizStatus;
  secondsPerQuestion: number;
  questions: number;
  players: number;
};

/** The quizzes the chapter has, and the two fields it takes to start a new one. */
export function QuizList({ quizzes, today }: { quizzes: Row[]; today: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [playsOn, setPlaysOn] = useState(today);
  const [seconds, setSeconds] = useState(String(QUIZ_SECONDS_DEFAULT));
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      const res = await createQuiz({ name, playsOn, secondsPerQuestion: seconds });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Quiz created. Add its questions next.");
      setName("");
      // Straight to the questions: a quiz with none can't be opened anyway.
      router.push(`/admin/quiz/${res.data.id}`);
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create a quiz</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="quiz-name">Quiz name</Label>
            <Input
              id="quiz-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. BNI Fundamentals Quiz"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quiz-date">Played on</Label>
            <DatePicker id="quiz-date" value={playsOn} onChange={setPlaysOn} className="sm:w-48" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quiz-seconds">Seconds a question</Label>
            <Input
              id="quiz-seconds"
              className="sm:w-36"
              inputMode="numeric"
              min={QUIZ_SECONDS_MIN}
              max={QUIZ_SECONDS_MAX}
              value={seconds}
              onChange={(e) => setSeconds(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Button disabled={pending || name.trim().length < 3 || !playsOn} onClick={create}>
            <PlusIcon /> Create quiz
          </Button>
        </CardContent>
      </Card>

      {quizzes.length === 0 ? (
        <EmptyState title="No quiz yet">
          Name one and pick the day it is played. You add the questions next.
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Played on</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Questions</TableHead>
                  <TableHead className="text-right">Joined</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {quizzes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/quiz/${q.id}`} className="hover:underline">
                        {q.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{q.secondsPerQuestion}s a question</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(istToDate(q.playsOn))}</TableCell>
                    <TableCell>
                      <QuizStatusBadge status={q.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{q.questions}</TableCell>
                    <TableCell className="text-right tabular-nums">{q.players}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" asChild aria-label={`Edit ${q.name}`} title="Edit">
                          <Link href={`/admin/quiz/${q.id}`}>
                            <PencilIcon />
                          </Link>
                        </Button>
                        {q.status === "draft" ? null : (
                          <Button variant="ghost" size="icon-sm" asChild aria-label={`Host ${q.name}`} title="Host">
                            <Link href={`/admin/quiz/${q.id}/run`}>
                              <PlayIcon />
                            </Link>
                          </Button>
                        )}
                        <ConfirmButton
                          label="Delete"
                          iconOnly
                          size="icon-sm"
                          variant="ghost"
                          icon={<Trash2Icon />}
                          ariaLabel={`Delete ${q.name}`}
                          title={`Delete "${q.name}"?`}
                          description="The questions, everyone who joined and all their answers go with it."
                          confirmLabel="Delete"
                          success="Quiz deleted."
                          action={() => deleteQuiz(q.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
