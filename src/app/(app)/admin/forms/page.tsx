import { desc, eq } from "drizzle-orm";
import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { form, formResponse } from "@/db/schema";
import { formState } from "@/lib/forms";
import { requireCapPage } from "@/lib/session";
import { FormRow } from "./form-row";

export const metadata: Metadata = { title: "Forms" };

export default async function AdminFormsPage() {
  await requireCapPage("forms.manage");
  // One row per form with its answer count. A left join would drop the forms
  // nobody has answered yet, which are exactly the ones just made.
  const rows = await db
    .select({
      id: form.id,
      slug: form.slug,
      title: form.title,
      visibility: form.visibility,
      opensAt: form.opensAt,
      closesAt: form.closesAt,
      maxResponses: form.maxResponses,
      isActive: form.isActive,
      questions: form.fields,
      createdAt: form.createdAt,
      responses: db.$count(formResponse, eq(formResponse.formId, form.id)),
    })
    .from(form)
    .orderBy(desc(form.createdAt));

  return (
    <PageContainer wide>
      <PageHeader
        title="Forms"
        description="Write a form, share its link on WhatsApp, read the answers here."
        back={{ href: "/admin", label: "Admin" }}
        inlineActions
        actions={
          <Button asChild>
            <Link href="/admin/forms/new">
              <PlusIcon /> New form
            </Link>
          </Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No forms yet">
          A form is a list of questions at its own link — visitor registration, an event headcount, a survey. Anyone you
          send the link to can answer it.
        </EmptyState>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {rows.map((f) => (
            <FormRow
              key={f.id}
              id={f.id}
              slug={f.slug}
              title={f.title}
              questions={f.questions.length}
              responses={f.responses}
              visibility={f.visibility}
              state={formState(f, f.responses)}
              closesAt={f.closesAt ? f.closesAt.toISOString() : null}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
