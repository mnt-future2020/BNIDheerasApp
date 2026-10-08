import { desc, eq } from "drizzle-orm";
import { ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { form, formResponse } from "@/db/schema";
import { formState } from "@/lib/forms";
import { requireMember } from "@/lib/session";
import { formatShortDate } from "@/lib/time";

export const metadata: Metadata = { title: "Forms" };

/**
 * The forms a member can answer right now. The link is still how a form
 * travels — it goes out on WhatsApp and works for anyone — but a member who
 * only has the app shouldn't have to go hunting through the group for it.
 *
 * Forms that have closed, filled up or not opened yet are left out entirely:
 * this is a list of things to do, not a record of things that happened.
 */
export default async function FormsPage() {
  await requireMember();
  const rows = await db
    .select({
      id: form.id,
      slug: form.slug,
      title: form.title,
      description: form.description,
      opensAt: form.opensAt,
      closesAt: form.closesAt,
      maxResponses: form.maxResponses,
      isActive: form.isActive,
      responses: db.$count(formResponse, eq(formResponse.formId, form.id)),
    })
    .from(form)
    .where(eq(form.isActive, true))
    .orderBy(desc(form.createdAt));

  const open = rows.filter((f) => formState(f, f.responses) === "open");

  return (
    <PageContainer>
      <PageHeader title="Forms" description="What the chapter is asking at the moment." />
      {open.length === 0 ? (
        <EmptyState title="Nothing to fill in">
          When the chapter puts out a form — a registration, a headcount, a survey — it appears here.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {open.map((f) => (
            <Link key={f.id} href={`/f/${f.slug}`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{f.title}</div>
                    {f.description ? (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{f.description}</p>
                    ) : null}
                    {f.closesAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">Closes {formatShortDate(f.closesAt)}</p>
                    ) : null}
                  </div>
                  <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
