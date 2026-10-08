import { count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { form, formResponse } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { requireCapPage } from "@/lib/session";
import { toIstDateInput } from "@/lib/time";
import { type EditorForm, FormEditor } from "../form-editor";
import { FormActions } from "./form-actions";

export const metadata: Metadata = { title: "Edit form" };

export default async function EditFormPage({ params }: PageProps<"/admin/forms/[id]">) {
  await requireCapPage("forms.manage");
  const { id } = await params;
  const [row] = await db.select().from(form).where(eq(form.id, id));
  if (!row) notFound();
  const [{ responses }] = await db.select({ responses: count() }).from(formResponse).where(eq(formResponse.formId, row.id));

  const initial: EditorForm = {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    fields: row.fields,
    visibility: row.visibility,
    opensOn: row.opensAt ? toIstDateInput(row.opensAt) : "",
    closesOn: row.closesAt ? toIstDateInput(row.closesAt) : "",
    maxResponses: row.maxResponses === null ? "" : String(row.maxResponses),
    onePerMember: row.onePerMember,
    isActive: row.isActive,
  };

  // The absolute link, so it can be pasted straight into WhatsApp. Without
  // NEXT_PUBLIC_APP_URL set there is no origin to build one from on the server,
  // and the relative path is at least still readable.
  const link = `${appUrl()}/f/${row.slug}`;

  return (
    <PageContainer>
      <PageHeader
        title={row.title}
        description="Changes apply to everyone who answers from now on."
        back={{ href: "/admin/forms", label: "Forms" }}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/forms/${row.id}/responses`}>
                {responses} answer{responses === 1 ? "" : "s"}
              </Link>
            </Button>
            <FormActions id={row.id} isActive={row.isActive} responses={responses} />
          </>
        }
      />

      <div className="mb-4 flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">The form&apos;s link</div>
          <a href={`/f/${row.slug}`} target="_blank" rel="noreferrer" className="block truncate text-sm hover:underline">
            {link}
          </a>
        </div>
        <CopyButton value={link} label="Link" />
      </div>

      <FormEditor initial={initial} responses={responses} />
    </PageContainer>
  );
}
