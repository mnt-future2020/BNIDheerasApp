"use client";

import { ChevronDownIcon, ChevronUpIcon, CopyIcon, GripVerticalIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveForm } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FORM_FIELD_TYPES, type FormField, type FormFieldType } from "@/db/schema";
import { FIELD_TYPE_LABELS, hasOptions } from "@/lib/forms";

export type EditorForm = {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  visibility: "public" | "members";
  opensOn: string;
  closesOn: string;
  maxResponses: string;
  onePerMember: boolean;
  isActive: boolean;
};

export const BLANK_FORM: EditorForm = {
  id: "",
  title: "",
  description: "",
  fields: [],
  // A form is made to be shared, so the link works for anyone unless the
  // chapter says otherwise. This is the whole point of the module.
  visibility: "public",
  opensOn: "",
  closesOn: "",
  maxResponses: "",
  onePerMember: false,
  isActive: true,
};

/** Ids are never shown; they only have to be stable and unlike each other. */
const newId = () => `q${Math.random().toString(36).slice(2, 10)}`;

function blankField(): FormField {
  return { id: newId(), type: "short_text", label: "", required: false };
}

/**
 * The form builder. One question at a time down the page, in the order the
 * person answering will meet them, so what you are editing looks like what
 * they will see. Everything saves together: there is no half-saved form.
 */
export function FormEditor({ initial, responses }: { initial: EditorForm; responses: number }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const set = <K extends keyof EditorForm>(k: K, value: EditorForm[K]) => setV((s) => ({ ...s, [k]: value }));

  const setField = (id: string, patch: Partial<FormField>) =>
    setV((s) => ({ ...s, fields: s.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));

  const move = (index: number, by: number) =>
    setV((s) => {
      const next = [...s.fields];
      const to = index + by;
      if (to < 0 || to >= next.length) return s;
      [next[index], next[to]] = [next[to], next[index]];
      return { ...s, fields: next };
    });

  const submit = () =>
    start(async () => {
      const res = await saveForm(v.id || null, {
        title: v.title,
        description: v.description,
        fields: v.fields,
        visibility: v.visibility,
        opensOn: v.opensOn || null,
        closesOn: v.closesOn || null,
        maxResponses: v.maxResponses ? Number(v.maxResponses) : null,
        onePerMember: v.onePerMember,
        isActive: v.isActive,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(v.id ? "Saved." : "Form created. Its link is on the form's page.");
      router.push(`/admin/forms/${res.data.id}`);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="form-title">Title</Label>
            <Input
              id="form-title"
              value={v.title}
              maxLength={160}
              placeholder="e.g. Visitor registration — November meeting"
              onChange={(e) => set("title", e.target.value)}
            />
            {!v.id ? (
              <p className="text-xs text-muted-foreground">The link is made from the title, and never changes afterwards.</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="form-desc">Description (optional)</Label>
            <Textarea
              id="form-desc"
              rows={2}
              maxLength={2000}
              value={v.description}
              placeholder="A line or two at the top of the form, for whoever opens the link."
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {v.fields.map((f, i) => (
        <QuestionCard
          key={f.id}
          field={f}
          index={i}
          last={i === v.fields.length - 1}
          onChange={(patch) => setField(f.id, patch)}
          onMove={(by) => move(i, by)}
          onDuplicate={() =>
            setV((s) => ({
              ...s,
              fields: [...s.fields.slice(0, i + 1), { ...f, id: newId() }, ...s.fields.slice(i + 1)],
            }))
          }
          onRemove={() => setV((s) => ({ ...s, fields: s.fields.filter((x) => x.id !== f.id) }))}
        />
      ))}

      <Button variant="outline" onClick={() => setV((s) => ({ ...s, fields: [...s.fields, blankField()] }))}>
        <PlusIcon /> Add question
      </Button>

      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="font-semibold">Who can answer, and until when</div>

          <div className="space-y-2">
            {(
              [
                ["public", "Anyone with the link", "No sign-in. A visitor types their name, a signed-in member is known already."],
                ["members", "Signed-in members only", "The link asks anyone else to sign in first."],
              ] as const
            ).map(([key, title, note]) => (
              <label key={key} className="flex items-start gap-3 rounded-lg border p-3">
                <input
                  type="radio"
                  name="visibility"
                  className="mt-1 accent-primary"
                  checked={v.visibility === key}
                  onChange={() => set("visibility", key)}
                />
                <span>
                  <span className="font-medium">{title}</span>
                  <span className="block text-sm text-muted-foreground">{note}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="form-opens">Opens on (optional)</Label>
              <DatePicker id="form-opens" value={v.opensOn} onChange={(d) => set("opensOn", d)} placeholder="Straight away" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="form-closes">Closes after (optional)</Label>
              <DatePicker id="form-closes" value={v.closesOn} onChange={(d) => set("closesOn", d)} placeholder="Stays open" />
            </div>
          </div>
          {v.opensOn || v.closesOn ? (
            <Button variant="ghost" size="sm" onClick={() => setV((s) => ({ ...s, opensOn: "", closesOn: "" }))}>
              Clear the dates
            </Button>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="form-max">Stop after this many answers (optional)</Label>
            <Input
              id="form-max"
              inputMode="numeric"
              className="sm:max-w-40"
              placeholder="No limit"
              value={v.maxResponses}
              onChange={(e) => set("maxResponses", e.target.value.replace(/\D/g, "").slice(0, 5))}
            />
          </div>

          <label className="flex items-start gap-3">
            <Checkbox
              className="mt-0.5"
              checked={v.onePerMember}
              onCheckedChange={(x) => set("onePerMember", !!x)}
            />
            <span>
              <span className="font-medium">One answer per member</span>
              <span className="block text-sm text-muted-foreground">
                Only holds for members who are signed in — nothing identifies a visitor at a public link.
              </span>
            </span>
          </label>

          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span>
              <span className="font-medium">Taking answers</span>
              <span className="block text-sm text-muted-foreground">
                Turn this off to stop the form without deleting anything.
              </span>
            </span>
            <Switch checked={v.isActive} onCheckedChange={(x) => set("isActive", x)} />
          </label>
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-10 flex items-center gap-3 rounded-xl border bg-card p-3 shadow-lg lg:bottom-4">
        <span className="text-sm text-muted-foreground">
          {v.fields.length === 0
            ? "No questions yet"
            : `${v.fields.length} question${v.fields.length === 1 ? "" : "s"}`}
          {responses > 0 ? ` · ${responses} answered` : ""}
        </span>
        <Button className="ml-auto" disabled={pending || v.title.trim().length < 2 || v.fields.length === 0} onClick={submit}>
          {v.id ? "Save changes" : "Create form"}
        </Button>
      </div>

      {/* Said once, at the bottom, where somebody editing a live form will meet
          it: an answer already given keeps the question it was given to. */}
      {v.id && responses > 0 ? (
        <p className="text-sm text-muted-foreground">
          {responses} answer{responses === 1 ? " is" : "s are"} already in. Editing a question changes it for everyone
          who answers from now on; what has come in already is kept as it was given.
        </p>
      ) : null}
    </div>
  );
}

function QuestionCard({
  field,
  index,
  last,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  field: FormField;
  index: number;
  last: boolean;
  onChange: (patch: Partial<FormField>) => void;
  onMove: (by: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const options = field.options ?? [];
  const setOptions = (next: string[]) => onChange({ options: next });

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-2">
          <GripVerticalIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Question {index + 1}</span>
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Move up" title="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
              <ChevronUpIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Move down" title="Move down" disabled={last} onClick={() => onMove(1)}>
              <ChevronDownIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Duplicate" title="Duplicate" onClick={onDuplicate}>
              <CopyIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Remove question" title="Remove" onClick={onRemove}>
              <Trash2Icon />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <div className="space-y-1.5">
            <Label htmlFor={`q-${field.id}`}>Question</Label>
            <Input
              id={`q-${field.id}`}
              value={field.label}
              maxLength={200}
              placeholder="e.g. Your business category"
              onChange={(e) => onChange({ label: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Answer type</Label>
            <Select
              value={field.type}
              onValueChange={(t) => {
                const type = t as FormFieldType;
                // Moving to a list type without a list is a dead end, so it
                // starts with two empty places rather than none.
                onChange({ type, options: hasOptions(type) ? (options.length ? options : ["", ""]) : undefined });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORM_FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FIELD_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`h-${field.id}`}>Hint (optional)</Label>
          <Input
            id={`h-${field.id}`}
            value={field.help ?? ""}
            maxLength={300}
            placeholder="Smaller text under the question"
            onChange={(e) => onChange({ help: e.target.value || undefined })}
          />
        </div>

        {hasOptions(field.type) ? (
          <div className="space-y-2">
            <Label>Options</Label>
            {options.map((o, i) => (
              // Keyed by position, because an option is a plain string and two
              // of them may read alike while being edited.
              <div key={i} className="flex gap-2">
                <Input
                  value={o}
                  maxLength={120}
                  placeholder={`Option ${i + 1}`}
                  onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove option ${i + 1}`}
                  disabled={options.length <= 2}
                  onClick={() => setOptions(options.filter((_, j) => j !== i))}
                >
                  <XIcon />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" disabled={options.length >= 30} onClick={() => setOptions([...options, ""])}>
              <PlusIcon /> Add option
            </Button>
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={field.required} onCheckedChange={(x) => onChange({ required: !!x })} />
          Must be answered
        </label>
      </CardContent>
    </Card>
  );
}
