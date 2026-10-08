"use server";

import { createHash } from "node:crypto";
import { and, count, eq, gte, like, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { FORM_FIELD_TYPES, FORM_VISIBILITIES, type FormField, form, formResponse } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { checkFields, formState, slugify, STATE_MESSAGES, validateAnswers } from "@/lib/forms";
import { requestMeta } from "@/lib/request-meta";
import { assertCap, getCurrentMember } from "@/lib/session";
import { istToDate } from "@/lib/time";

const fieldSchema = z.object({
  id: z.string().trim().min(1).max(40),
  type: z.enum(FORM_FIELD_TYPES),
  label: z.string().trim().min(1, "A question needs a label").max(200),
  help: z.string().trim().max(300).optional(),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
});

/** Dates come from a date picker, so a form opens at midnight and closes at the end of its last day. */
const dayStart = (d: string | null | undefined) => (d ? istToDate(d, "00:00") : null);
const dayEnd = (d: string | null | undefined) => (d ? istToDate(d, "23:59") : null);

const saveSchema = z.object({
  title: z.string().trim().min(2, "Give the form a title").max(160),
  description: z.string().trim().max(2000).optional().transform((v) => v || null),
  fields: z.array(fieldSchema).min(1, "Add at least one question").max(50),
  visibility: z.enum(FORM_VISIBILITIES),
  opensOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  closesOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  maxResponses: z.number().int().min(1).max(100_000).nullable(),
  onePerMember: z.boolean(),
  isActive: z.boolean(),
});

/**
 * A link that reads like the form it opens. The title decides it, and a number
 * is added only when that address is already taken — so the first "Visitor
 * Registration" keeps /f/visitor-registration and never has it moved out from
 * under it, which would break every link already shared.
 */
async function freeSlug(title: string, keepId: string | null): Promise<string> {
  const base = slugify(title);
  const taken = new Set(
    (
      await db
        .select({ slug: form.slug, id: form.id })
        .from(form)
        .where(or(eq(form.slug, base), like(form.slug, `${base}-%`)))
    )
      .filter((r) => r.id !== keepId)
      .map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  throw new UserError("Too many forms share that title. Please change it a little.");
}

/** Head Table, Event Coordinator or admin: write a new form, or edit one. */
export async function saveForm(id: string | null, input: z.input<typeof saveSchema>): Promise<ActionResult<{ id: string; slug: string }>> {
  return runAction(async () => {
    const me = await assertCap("forms.manage");
    const data = saveSchema.parse(input);
    const fields = data.fields as FormField[];
    // The same check the builder runs, repeated here because the builder is a
    // page in somebody's browser and this is not.
    const problem = checkFields(fields);
    if (problem) throw new UserError(problem);

    const opensAt = dayStart(data.opensOn);
    const closesAt = dayEnd(data.closesOn);
    if (opensAt && closesAt && closesAt.getTime() <= opensAt.getTime()) {
      throw new UserError("The closing date has to be after the opening date.");
    }

    const values = {
      title: data.title,
      description: data.description,
      fields,
      visibility: data.visibility,
      opensAt,
      closesAt,
      maxResponses: data.maxResponses,
      onePerMember: data.onePerMember,
      isActive: data.isActive,
    };

    if (id) {
      const [before] = await db.select().from(form).where(eq(form.id, z.uuid().parse(id)));
      if (!before) throw new UserError("That form no longer exists.");
      // The address is fixed once it exists. A form's link goes out on WhatsApp
      // the moment it is made, and renaming the form must not break it.
      await db.update(form).set(values).where(eq(form.id, before.id));
      await audit({
        actorId: me.id,
        action: "form.update",
        entity: "form",
        entityId: before.id,
        before: { title: before.title, questions: before.fields.length, isActive: before.isActive },
        after: { title: data.title, questions: fields.length, isActive: data.isActive },
      });
      refresh();
      return { id: before.id, slug: before.slug };
    }

    const slug = await freeSlug(data.title, null);
    const [row] = await db
      .insert(form)
      .values({ ...values, slug, createdById: me.id })
      .returning({ id: form.id, slug: form.slug });
    await audit({
      actorId: me.id,
      action: "form.create",
      entity: "form",
      entityId: row.id,
      after: { title: data.title, questions: fields.length, link: `/f/${slug}` },
    });
    refresh();
    return row;
  });
}

/** Stop or restart a form without touching its questions or what has come in. */
export async function setFormActive(id: string, isActive: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("forms.manage");
    const [row] = await db
      .update(form)
      .set({ isActive: z.boolean().parse(isActive) })
      .where(eq(form.id, z.uuid().parse(id)))
      .returning({ id: form.id, title: form.title });
    if (!row) throw new UserError("That form no longer exists.");
    await audit({
      actorId: me.id,
      action: isActive ? "form.reopen" : "form.pause",
      entity: "form",
      entityId: row.id,
      after: { title: row.title },
    });
    refresh();
    return null;
  });
}

/** The form and every answer to it. The audit log keeps the count that went. */
export async function deleteForm(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("forms.manage");
    const formId = z.uuid().parse(id);
    const [{ responses }] = await db
      .select({ responses: count() })
      .from(formResponse)
      .where(eq(formResponse.formId, formId));
    const [row] = await db.delete(form).where(eq(form.id, formId)).returning();
    if (!row) throw new UserError("That form no longer exists.");
    await audit({
      actorId: me.id,
      action: "form.delete",
      entity: "form",
      entityId: row.id,
      before: { title: row.title, link: `/f/${row.slug}`, responses },
    });
    refresh();
    return null;
  });
}

/** One answer taken out — a test entry, or a duplicate somebody sent twice. */
export async function deleteResponse(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("forms.manage");
    const [row] = await db.delete(formResponse).where(eq(formResponse.id, z.uuid().parse(id))).returning();
    if (!row) throw new UserError("That answer no longer exists.");
    await audit({ actorId: me.id, action: "form.response_delete", entity: "form", entityId: row.formId });
    refresh();
    return null;
  });
}

/* ------------------------------------------------------------------ */
/* Answering — the only action here that a signed-out visitor may run  */
/* ------------------------------------------------------------------ */

const ipHash = (ip: string | null) =>
  ip ? createHash("sha256").update(`${process.env.BETTER_AUTH_SECRET ?? "dev"}|form:${ip}`).digest("base64url") : null;

const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX = 10;

const submitSchema = z.object({
  formId: z.uuid(),
  /** Only read when nobody is signed in; a member's name comes from their record. */
  name: z.string().trim().max(120).optional(),
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
});

/**
 * Anyone with the link, signed in or not. Everything the page decided is
 * decided again here — whether the form is open, whether this person has
 * already answered, whether each answer fits its question — because the page
 * is in the hand of whoever is answering and this is not.
 */
export async function submitResponse(input: z.input<typeof submitSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const data = submitSchema.parse(input);
    const me = await getCurrentMember();

    const [f] = await db.select().from(form).where(eq(form.id, data.formId));
    if (!f) throw new UserError("That form no longer exists.");
    if (f.visibility === "members" && !me) throw new UserError("Please sign in to answer this form.");

    const [{ responses }] = await db
      .select({ responses: count() })
      .from(formResponse)
      .where(eq(formResponse.formId, f.id));
    const state = formState(f, responses);
    if (state !== "open") throw new UserError(STATE_MESSAGES[state]);

    // Only a signed-in member can be held to one answer: nothing identifies a
    // visitor at a public link well enough to refuse them a second time.
    if (f.onePerMember && me) {
      const [already] = await db
        .select({ id: formResponse.id })
        .from(formResponse)
        .where(and(eq(formResponse.formId, f.id), eq(formResponse.memberId, me.id)));
      if (already) throw new UserError("You have already answered this form.");
    }

    const name = me ? null : (data.name ?? "");
    if (!me && name!.length < 2) throw new UserError("Please write your name first.");

    const checked = validateAnswers(f.fields, data.answers);
    if (!checked.ok) {
      const first = Object.entries(checked.errors)[0];
      const label = f.fields.find((x) => x.id === first[0])?.label ?? "An answer";
      throw new UserError(`${label}: ${first[1]}`);
    }

    const { ip } = await requestMeta();
    const hashed = ipHash(ip);
    // A crude ceiling on one connection filling a form up by itself. Signed-in
    // members are past it: they are already named, and onePerMember is the
    // limit that applies to them.
    if (hashed && !me) {
      const [{ recent }] = await db
        .select({ recent: count() })
        .from(formResponse)
        .where(and(eq(formResponse.ipHash, hashed), gte(formResponse.createdAt, new Date(Date.now() - RATE_WINDOW_MS))));
      if (recent >= RATE_MAX) throw new UserError("That's a lot of answers at once. Please wait a few minutes.");
    }

    await db.insert(formResponse).values({
      formId: f.id,
      memberId: me?.id ?? null,
      respondentName: name,
      data: checked.data,
      ipHash: hashed,
    });
    // Deliberately not audited: the audit log is the Head Table's record of who
    // changed the app, and an answer is not a change to it. The responses page
    // is where answers are read.
    return null;
  });
}
