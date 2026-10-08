import { describe, expect, it } from "vitest";
import type { FormField } from "@/db/schema";
import { answerText, checkFields, formState, slugify, validateAnswers } from "@/lib/forms";

const field = (over: Partial<FormField> & Pick<FormField, "id" | "type">): FormField => ({
  label: "A question",
  required: false,
  ...over,
});

describe("the form's link", () => {
  it("reads like the title it came from", () => {
    expect(slugify("Visitor Registration")).toBe("visitor-registration");
    expect(slugify("November meeting — headcount!")).toBe("november-meeting-headcount");
    expect(slugify("  Spaces   everywhere  ")).toBe("spaces-everywhere");
  });

  it("always produces something, even from a title with no latin letters", () => {
    expect(slugify("தீரஸ்")).toBe("form");
    expect(slugify("!!!")).toBe("form");
  });

  it("never ends on a hyphen, however the title is cut short", () => {
    const slug = slugify(`${"a".repeat(59)} tail`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("whether a form is taking answers", () => {
  const open = { opensAt: null, closesAt: null, maxResponses: null, isActive: true };
  const now = new Date("2026-10-08T06:00:00Z");

  it("is open with nothing set against it", () => {
    expect(formState(open, 0, now)).toBe("open");
  });

  it("names the reason it is shut, rather than just being shut", () => {
    expect(formState({ ...open, isActive: false }, 0, now)).toBe("paused");
    expect(formState({ ...open, opensAt: new Date("2026-10-09T00:00:00Z") }, 0, now)).toBe("not_open_yet");
    expect(formState({ ...open, closesAt: new Date("2026-10-07T00:00:00Z") }, 0, now)).toBe("closed");
    expect(formState({ ...open, maxResponses: 5 }, 5, now)).toBe("full");
  });

  it("counts the cap as places taken, so the last place is still a place", () => {
    expect(formState({ ...open, maxResponses: 5 }, 4, now)).toBe("open");
  });

  it("puts paused ahead of every other reason", () => {
    // Reopening a form whose closing date has passed should still read as
    // closed, not jump back to open — but paused is what the chapter chose.
    expect(formState({ ...open, isActive: false, closesAt: new Date("2026-10-07T00:00:00Z") }, 0, now)).toBe("paused");
  });
});

describe("checking an answer against the question that asked for it", () => {
  it("wants the required ones and lets the rest go", () => {
    const fields = [field({ id: "a", type: "short_text", required: true }), field({ id: "b", type: "short_text" })];
    const bad = validateAnswers(fields, { a: "  ", b: "" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors)).toEqual(["a"]);

    const good = validateAnswers(fields, { a: "Yes", b: "" });
    expect(good.ok).toBe(true);
    // An empty optional answer is simply not stored.
    if (good.ok) expect(good.data).toEqual({ a: "Yes" });
  });

  it("trims what was typed before storing it", () => {
    const r = validateAnswers([field({ id: "a", type: "short_text" })], { a: "  Uma  " });
    expect(r.ok && r.data.a).toBe("Uma");
  });

  it("holds each type to its own shape", () => {
    const check = (f: FormField, value: string | string[]) => validateAnswers([f], { [f.id]: value }).ok;
    expect(check(field({ id: "e", type: "email" }), "someone@example.com")).toBe(true);
    expect(check(field({ id: "e", type: "email" }), "someone@")).toBe(false);
    expect(check(field({ id: "p", type: "phone" }), "+91 98400 12345")).toBe(true);
    expect(check(field({ id: "p", type: "phone" }), "123")).toBe(false);
    expect(check(field({ id: "n", type: "number" }), "42")).toBe(true);
    expect(check(field({ id: "n", type: "number" }), "forty-two")).toBe(false);
    expect(check(field({ id: "d", type: "date" }), "2026-10-08")).toBe(true);
    expect(check(field({ id: "d", type: "date" }), "08/10/2026")).toBe(false);
    expect(check(field({ id: "y", type: "yes_no" }), "Yes")).toBe(true);
    expect(check(field({ id: "y", type: "yes_no" }), "Maybe")).toBe(false);
    expect(check(field({ id: "r", type: "rating" }), "5")).toBe(true);
    expect(check(field({ id: "r", type: "rating" }), "6")).toBe(false);
    expect(check(field({ id: "r", type: "rating" }), "0")).toBe(false);
  });

  it("refuses a choice that wasn't offered", () => {
    const one = field({ id: "c", type: "single_choice", options: ["Yes", "No"] });
    expect(validateAnswers([one], { c: "Yes" }).ok).toBe(true);
    expect(validateAnswers([one], { c: "Something else" }).ok).toBe(false);

    const many = field({ id: "m", type: "multi_choice", options: ["A", "B", "C"] });
    expect(validateAnswers([many], { m: ["A", "C"] }).ok).toBe(true);
    expect(validateAnswers([many], { m: ["A", "D"] }).ok).toBe(false);
    expect(validateAnswers([many], { m: ["A", "A"] }).ok).toBe(false);
  });

  it("won't take a list where one answer was asked for, or the reverse", () => {
    expect(validateAnswers([field({ id: "a", type: "short_text" })], { a: ["one", "two"] }).ok).toBe(false);
    expect(validateAnswers([field({ id: "m", type: "multi_choice", options: ["A"] })], { m: "A" }).ok).toBe(false);
  });

  it("drops answers to questions the form doesn't have", () => {
    // A page left open while the form was edited: what it sends for a question
    // since deleted is ignored rather than stored or rejected.
    const r = validateAnswers([field({ id: "a", type: "short_text" })], { a: "kept", gone: "dropped" });
    expect(r.ok && r.data).toEqual({ a: "kept" });
  });

  it("holds long answers to a length", () => {
    expect(validateAnswers([field({ id: "a", type: "short_text" })], { a: "x".repeat(501) }).ok).toBe(false);
    expect(validateAnswers([field({ id: "a", type: "long_text" })], { a: "x".repeat(501) }).ok).toBe(true);
  });
});

describe("what the builder may save", () => {
  it("wants a question, a label on it, and options where the type needs them", () => {
    expect(checkFields([])).toMatch(/at least one question/i);
    expect(checkFields([field({ id: "a", type: "short_text", label: "  " })])).toMatch(/needs a label/i);
    expect(checkFields([field({ id: "a", type: "dropdown", options: ["only one"] })])).toMatch(/two options/i);
    expect(checkFields([field({ id: "a", type: "dropdown", options: ["one", "two"] })])).toBeNull();
    expect(checkFields([field({ id: "a", type: "short_text" }), field({ id: "a", type: "short_text" })])).toMatch(/share an id/i);
  });
});

describe("one answer written out", () => {
  it("joins a list and leaves a missing answer blank", () => {
    expect(answerText(["A", "B"])).toBe("A; B");
    expect(answerText("Just this")).toBe("Just this");
    expect(answerText(undefined)).toBe("");
  });
});
