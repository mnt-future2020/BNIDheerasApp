import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { requireCapPage } from "@/lib/session";
import { BLANK_FORM, FormEditor } from "../form-editor";

export const metadata: Metadata = { title: "New form" };

export default async function NewFormPage() {
  await requireCapPage("forms.manage");
  return (
    <PageContainer>
      <PageHeader
        title="New form"
        description="Questions in the order they'll be answered. Nothing is shared until you copy the link."
        back={{ href: "/admin/forms", label: "Forms" }}
      />
      <FormEditor initial={BLANK_FORM} responses={0} />
    </PageContainer>
  );
}
