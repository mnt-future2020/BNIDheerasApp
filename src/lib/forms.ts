import type { FormField, FormFieldType } from "@/db/schema";

/**
 * The rules a form runs by, kept away from the database so both sides can use
 * them: the page in the hand checks as you type, and the server action checks
 * again before anything is stored. A browser with the JavaScript turned off, or
 * a crafted POST, meets exactly the same rules.
 */

/** What each question type is called, in the builder and nowhere else. */
export const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  short_text: "Short answer",
  long_text: "Paragraph",
  number: "Number",
  email: "Email",
  phone: "Mobile number",
  single_choice: "Choose one",
  multi_choice: "Choose several",
  dropdown: "Dropdown",
  rating: "Rating out of 5",
  date: "Date",
  yes_no: "Yes / No",
};

/** The three types that carry a list to choose from, so the builder asks for one. */
export function hasOptions(type: FormFieldType): boolean {
  return type === "single_choice" || type === "multi_choice" || type === "dropdown";
}

/** Several answers at once — the only type whose answer is a list. */
export function isMultiple(type: FormFieldType): boolean {
  return type === "multi_choice";
}

export const RATING_MAX = 5;
export const YES_NO = ["Yes", "No"] as const;

const MAX_LENGTH: Partial<Record<FormFieldType, number>> = {
  short_text: 500,
  long_text: 5000,
  email: 160,
  phone: 20,
  number: 20,
};

/**
 * A readable address for the form, made from its title: "Visitor Registration"
 * becomes /f/visitor-registration. A link that says what it is survives being
 * forwarded through WhatsApp, where an opaque id reads like something to
 * distrust. Uniqueness is the caller's job — the slug is a column, not a hope.
 */
export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    // Anything that isn't a letter or a digit becomes one hyphen: Tamil titles
    // reduce to nothing here, which is what the fallback below is for.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return base || "form";
}

export type FormWindow = {
  /** What a form is open for: new responses, the title, the dates, the cap. */
  opensAt: Date | null;
  closesAt: Date | null;
  maxResponses: number | null;
  isActive: boolean;
};

export type FormState = "paused" | "not_open_yet" | "open" | "closed" | "full";

/**
 * Whether a form is taking answers, and if not, why. Four ways to be shut and
 * only one to be open, so the public page can say which — "this closed on
 * Tuesday" is an answer, "not available" is a shrug.
 */
export function formState(f: FormWindow, responses: number, now = new Date()): FormState {
  if (!f.isActive) return "paused";
  if (f.opensAt && now.getTime() < f.opensAt.getTime()) return "not_open_yet";
  if (f.closesAt && now.getTime() > f.closesAt.getTime()) return "closed";
  // The cap counts what is already in, so the last place is taken by whoever
  // submits first; the server checks again, because two people can be looking
  // at the last place at the same moment.
  if (f.maxResponses !== null && responses >= f.maxResponses) return "full";
  return "open";
}

export const STATE_MESSAGES: Record<Exclude<FormState, "open">, string> = {
  paused: "This form isn't taking answers at the moment.",
  not_open_yet: "This form hasn't opened yet.",
  closed: "This form has closed.",
  full: "This form has all the answers it was asking for.",
};

export type AnswerMap = Record<string, string | string[]>;
export type Invalid = { ok: false; errors: Record<string, string> };
export type Valid = { ok: true; data: AnswerMap };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** One answer as the person typed it, trimmed; a list keeps only real entries. */
function clean(value: string | string[] | undefined): string | string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return typeof value === "string" ? value.trim() : "";
}

const isEmpty = (v: string | string[]) => (Array.isArray(v) ? v.length === 0 : v === "");

/**
 * Every answer checked against the question that asked for it. Questions the
 * form doesn't have are dropped rather than rejected: a stale page in somebody's
 * pocket shouldn't fail, and nothing it sends should reach the database either.
 */
export function validateAnswers(fields: FormField[], raw: AnswerMap): Valid | Invalid {
  const errors: Record<string, string> = {};
  const data: AnswerMap = {};

  for (const field of fields) {
    const value = clean(raw[field.id]);
    if (isEmpty(value)) {
      if (field.required) errors[field.id] = "This one is needed.";
      continue;
    }

    // A list answer where one was expected (or the reverse) is a broken client,
    // not a typo: say so plainly rather than silently keeping half of it.
    if (Array.isArray(value) !== isMultiple(field.type)) {
      errors[field.id] = "That answer doesn't fit this question.";
      continue;
    }

    const problem = checkOne(field, value);
    if (problem) errors[field.id] = problem;
    else data[field.id] = value;
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

function checkOne(field: FormField, value: string | string[]): string | null {
  const options = field.options ?? [];

  if (Array.isArray(value)) {
    // Checkboxes: every tick has to be one of the boxes offered.
    if (value.some((v) => !options.includes(v))) return "Choose from the options given.";
    if (new Set(value).size !== value.length) return "The same option was chosen twice.";
    return null;
  }

  const max = MAX_LENGTH[field.type];
  if (max && value.length > max) return `Please keep this under ${max} characters.`;

  switch (field.type) {
    case "single_choice":
    case "dropdown":
      return options.includes(value) ? null : "Choose from the options given.";
    case "yes_no":
      return (YES_NO as readonly string[]).includes(value) ? null : "Answer Yes or No.";
    case "rating": {
      const n = Number(value);
      return Number.isInteger(n) && n >= 1 && n <= RATING_MAX ? null : `Give a rating from 1 to ${RATING_MAX}.`;
    }
    case "number":
      return Number.isFinite(Number(value)) ? null : "Enter a number.";
    case "email":
      return EMAIL.test(value) ? null : "Enter an email address.";
    case "phone":
      // Deliberately loose: the chapter takes landlines, +91 numbers and
      // numbers written with spaces, and a form is not the place to argue.
      return value.replace(/\D/g, "").length >= 8 ? null : "Enter a mobile number.";
    case "date":
      return DATE.test(value) && !Number.isNaN(Date.parse(value)) ? null : "Pick a date.";
    default:
      return null;
  }
}

/** One stored answer as a line of text — for the responses table and the CSV. */
export function answerText(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join("; ");
  return value ?? "";
}

/**
 * What the builder may save. A question with no label is a question nobody can
 * answer, and a list with nothing in it is a dead end, so both are refused here
 * rather than reaching the person filling it in.
 */
export function checkFields(fields: FormField[]): string | null {
  if (fields.length === 0) return "Add at least one question.";
  for (const [i, f] of fields.entries()) {
    if (!f.label.trim()) return `Question ${i + 1} needs a label.`;
    if (hasOptions(f.type) && (f.options ?? []).filter((o) => o.trim()).length < 2) {
      return `Question ${i + 1} needs at least two options.`;
    }
  }
  if (new Set(fields.map((f) => f.id)).size !== fields.length) return "Two questions share an id.";
  return null;
}
