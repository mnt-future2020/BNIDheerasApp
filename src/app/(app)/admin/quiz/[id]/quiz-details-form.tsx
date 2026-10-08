"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateQuiz } from "@/actions/quiz";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QUIZ_SECONDS_MAX, QUIZ_SECONDS_MIN } from "@/db/schema";

/** The quiz's name, the day it is played and how long a question stays up. */
export function QuizDetailsForm({
  quizId,
  name: initialName,
  playsOn: initialDate,
  secondsPerQuestion,
  lockSeconds,
}: {
  quizId: string;
  name: string;
  playsOn: string;
  secondsPerQuestion: number;
  /** Mid-quiz the clock can't move: it would shift the deadline already running. */
  lockSeconds: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [playsOn, setPlaysOn] = useState(initialDate);
  const [seconds, setSeconds] = useState(String(secondsPerQuestion));
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await updateQuiz(quizId, { name, playsOn, secondsPerQuestion: seconds });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Quiz saved.");
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="edit-name">Quiz name</Label>
          <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-date">Played on</Label>
          <DatePicker id="edit-date" value={playsOn} onChange={setPlaysOn} className="sm:w-48" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-seconds">Seconds a question</Label>
          <Input
            id="edit-seconds"
            className="sm:w-36"
            inputMode="numeric"
            disabled={lockSeconds}
            min={QUIZ_SECONDS_MIN}
            max={QUIZ_SECONDS_MAX}
            value={seconds}
            onChange={(e) => setSeconds(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <Button variant="outline" disabled={pending || name.trim().length < 3} onClick={save}>
          Save details
        </Button>
      </CardContent>
    </Card>
  );
}
