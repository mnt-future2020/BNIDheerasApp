"use client";

import { CheckCircle2Icon, SendIcon, StarIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitResponse } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FormField } from "@/db/schema";
import { type AnswerMap, isMultiple, RATING_MAX, validateAnswers, YES_NO } from "@/lib/forms";

type Me = { name: string; email: string; phone: string | null };

/**
 * The form as the person answering meets it. Who they are is settled once at
 * the top — a signed-in member is simply told we know them, and everyone else
 * types a name — and then it is questions all the way down.
 *
 * Answers are checked here as they are sent so mistakes are pointed at the
 * question that has them, and checked again on the server, which is the one
 * that counts.
 */
export function FillForm({ formId, fields, me }: { formId: string; fields: FormField[]; me: Me | null }) {
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<AnswerMap>(() => prefill(fields, me));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const set = (id: string, value: string | string[]) => {
    setAnswers((a) => ({ ...a, [id]: value }));
    // The message goes the moment the answer changes: leaving it under a field
    // that has just been corrected reads as if the correction didn't take.
    setErrors((e) => (e[id] ? { ...e, [id]: "" } : e));
  };

  if (done) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 py-6">
          <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-medium">Thank you — your answer is in.</p>
            <p className="mt-1 text-sm text-muted-foreground">You can close this page.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const submit = () => {
    const checked = validateAnswers(fields, answers);
    if (!checked.ok) {
      setErrors(checked.errors);
      const firstId = fields.find((f) => checked.errors[f.id])?.id;
      if (firstId) document.getElementById(`f-${firstId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return void toast.error("Some answers still need a look.");
    }
    if (!me && name.trim().length < 2) return void toast.error("Please write your name first.");

    start(async () => {
      const res = await submitResponse({ formId, name: me ? undefined : name, answers: checked.data });
      if (!res.ok) return void toast.error(res.error);
      setDone(true);
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4">
          {me ? (
            // Signed in: nothing to type. Saying whose answer this will be
            // matters on a shared phone, where it may not be the reader's.
            <div className="text-sm">
              Answering as <span className="font-medium">{me.name}</span>.
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="f-name">
                Your name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="f-name"
                value={name}
                maxLength={120}
                autoComplete="name"
                placeholder="So the chapter knows who answered"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {fields.map((field) => (
        <Card key={field.id} id={`f-${field.id}`}>
          <CardContent className="space-y-2 py-4">
            <Label htmlFor={inputId(field)} className="text-base leading-snug">
              {field.label}
              {field.required ? <span className="ml-1 text-destructive">*</span> : null}
            </Label>
            {field.help ? <p className="text-sm text-muted-foreground">{field.help}</p> : null}
            <Question field={field} value={answers[field.id]} onChange={(v) => set(field.id, v)} />
            {errors[field.id] ? <p className="text-sm text-destructive">{errors[field.id]}</p> : null}
          </CardContent>
        </Card>
      ))}

      <Button size="lg" className="w-full" disabled={pending} onClick={submit}>
        <SendIcon /> Send
      </Button>
      <p className="text-center text-xs text-muted-foreground">An answer can&apos;t be changed once it is sent.</p>
    </div>
  );
}

/**
 * What the app already knows about a signed-in member, written into the
 * questions that ask for it. Only email and mobile: everything else a form
 * asks is about this form, and guessing at it would be putting words in their
 * mouth. Every prefilled answer stays editable.
 */
function prefill(fields: FormField[], me: Me | null): AnswerMap {
  const answers: AnswerMap = {};
  for (const f of fields) {
    if (isMultiple(f.type)) answers[f.id] = [];
    else if (me && f.type === "email") answers[f.id] = me.email;
    else if (me && f.type === "phone" && me.phone) answers[f.id] = me.phone;
    else answers[f.id] = "";
  }
  return answers;
}

const inputId = (f: FormField) => `q-${f.id}`;

function Question({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  const text = typeof value === "string" ? value : "";
  const list = Array.isArray(value) ? value : [];
  const options = field.options ?? [];
  const id = inputId(field);

  switch (field.type) {
    case "long_text":
      return <Textarea id={id} rows={4} maxLength={5000} value={text} onChange={(e) => onChange(e.target.value)} />;

    case "number":
      return <Input id={id} inputMode="decimal" value={text} onChange={(e) => onChange(e.target.value)} />;

    case "email":
      return <Input id={id} type="email" autoComplete="email" value={text} onChange={(e) => onChange(e.target.value)} />;

    case "phone":
      return <Input id={id} type="tel" autoComplete="tel" value={text} onChange={(e) => onChange(e.target.value)} />;

    case "date":
      // The browser's own date field: on a phone it is the picker the person
      // already knows, and it hands back exactly the YYYY-MM-DD wanted here.
      return <Input id={id} type="date" value={text} onChange={(e) => onChange(e.target.value)} />;

    case "yes_no":
    case "single_choice": {
      const choices = field.type === "yes_no" ? [...YES_NO] : options;
      return (
        <RadioGroup value={text} onValueChange={onChange} className="gap-2 pt-1">
          {choices.map((o) => (
            <label key={o} className="flex items-center gap-3 rounded-lg border p-3">
              <RadioGroupItem value={o} id={`${id}-${o}`} />
              <span>{o}</span>
            </label>
          ))}
        </RadioGroup>
      );
    }

    case "multi_choice":
      return (
        <div className="space-y-2 pt-1">
          {options.map((o) => (
            <label key={o} className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={list.includes(o)}
                onCheckedChange={(on) =>
                  // Kept in the order the options are listed, not the order
                  // they were ticked, so every answer reads the same way.
                  onChange(on ? options.filter((x) => x === o || list.includes(x)) : list.filter((x) => x !== o))
                }
              />
              <span>{o}</span>
            </label>
          ))}
        </div>
      );

    case "dropdown":
      return (
        <Select value={text} onValueChange={onChange}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Choose one" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "rating":
      return (
        <div className="flex gap-1 pt-1">
          {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => (
            <Button
              key={n}
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`${n} out of ${RATING_MAX}`}
              aria-pressed={Number(text) === n}
              onClick={() => onChange(Number(text) === n ? "" : String(n))}
            >
              <StarIcon className={Number(text) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground"} />
            </Button>
          ))}
        </div>
      );

    default:
      return <Input id={id} maxLength={500} value={text} onChange={(e) => onChange(e.target.value)} />;
  }
}
