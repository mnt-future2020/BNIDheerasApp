import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { FeedbackStatusBadge } from "@/components/feedback-status";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { db } from "@/db";
import { feedback, member } from "@/db/schema";
import { requireCapPage } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import { FeedbackReview } from "./feedback-review";

export const metadata: Metadata = { title: "Suggestions & feedback" };

/** Enough to hold a term's worth; older ones are in the audit log. */
const LIMIT = 200;

export default async function FeedbackAdminPage() {
  await requireCapPage("feedback.manage");
  const rows = await db
    .select({ f: feedback, name: member.fullName })
    .from(feedback)
    .innerJoin(member, eq(member.id, feedback.memberId))
    .orderBy(desc(feedback.createdAt))
    .limit(LIMIT);

  // Two sections, so no filters are needed to tell them apart.
  const sections = [
    { kind: "suggestion" as const, title: "Suggestions" },
    { kind: "feedback" as const, title: "Feedback" },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Suggestions & feedback"
        back={{ href: "/admin", label: "Admin" }}
        description="Consider it or not — either way the member hears back."
      />
      <div className="space-y-8">
        {sections.map((s) => {
          const items = rows.filter((r) => r.f.kind === s.kind);
          return (
            <section key={s.kind}>
              <h2 className="mb-2 font-semibold">
                {s.title} ({items.length})
              </h2>
              {items.length === 0 ? (
                <EmptyState title={`No ${s.title.toLowerCase()} yet.`} />
              ) : (
                <div className="space-y-3">
                  {items.map(({ f, name }) => (
                    <Card key={f.id}>
                      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{f.anonymous ? "Anonymous" : name}</span>
                          <span className="text-muted-foreground">{formatDateTime(f.createdAt)}</span>
                        </div>
                        <FeedbackStatusBadge status={f.status} />
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm whitespace-pre-line">{f.message}</p>
                        <FeedbackReview id={f.id} status={f.status} response={f.response} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </PageContainer>
  );
}
