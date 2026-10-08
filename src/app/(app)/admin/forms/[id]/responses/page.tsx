import { desc, eq } from "drizzle-orm";
import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { form, formResponse, member } from "@/db/schema";
import { answerText } from "@/lib/forms";
import { requireCapPage } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import { DeleteResponseButton } from "./delete-response-button";

export const metadata: Metadata = { title: "Answers" };

export default async function FormResponsesPage({ params }: PageProps<"/admin/forms/[id]/responses">) {
  await requireCapPage("forms.manage");
  const { id } = await params;
  const [f] = await db.select().from(form).where(eq(form.id, id));
  if (!f) notFound();

  // A member's name is read from their record, not from a copy taken when they
  // answered, so it stays right when they change it.
  const rows = await db
    .select({
      id: formResponse.id,
      at: formResponse.createdAt,
      data: formResponse.data,
      typedName: formResponse.respondentName,
      memberName: member.fullName,
    })
    .from(formResponse)
    .leftJoin(member, eq(member.id, formResponse.memberId))
    .where(eq(formResponse.formId, f.id))
    .orderBy(desc(formResponse.createdAt));

  return (
    <PageContainer wide>
      <PageHeader
        title="Answers"
        description={f.title}
        back={{ href: `/admin/forms/${f.id}`, label: "Back to the form" }}
        inlineActions
        actions={
          rows.length ? (
            <Button asChild variant="outline" size="sm">
              {/* A plain link, not fetch: the browser saves the file itself. */}
              <a href={`/api/forms/${f.id}/responses`}>
                <DownloadIcon /> Download CSV
              </a>
            </Button>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="Nothing answered yet">
          Share the form&apos;s link and the answers appear here as they come in.
        </EmptyState>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">When</TableHead>
                <TableHead className="whitespace-nowrap">Who</TableHead>
                {f.fields.map((q) => (
                  <TableHead key={q.id} className="min-w-40">
                    {q.label}
                  </TableHead>
                ))}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.at)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.memberName ? (
                      <>
                        {r.memberName} <span className="text-xs text-muted-foreground">· member</span>
                      </>
                    ) : (
                      (r.typedName ?? <span className="text-muted-foreground">Not given</span>)
                    )}
                  </TableCell>
                  {/* Columns follow the form's questions, so an answer to a
                      question since deleted simply has nowhere to show. */}
                  {f.fields.map((q) => (
                    <TableCell key={q.id} className="align-top whitespace-pre-line">
                      {answerText(r.data[q.id])}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <DeleteResponseButton id={r.id} who={r.memberName ?? r.typedName ?? "this answer"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageContainer>
  );
}
