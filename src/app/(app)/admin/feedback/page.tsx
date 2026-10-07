import { and, desc, eq, gte, lt } from "drizzle-orm";
import type { Metadata } from "next";
import { FeedbackStatusBadge } from "@/components/feedback-status";
import { MonthFilter } from "@/components/month-filter";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { db } from "@/db";
import { feedback, member } from "@/db/schema";
import { monthOptions, monthWindow, tenureMonthKeys } from "@/lib/months";
import { requireCapPage } from "@/lib/session";
import { selectedTenure, tenureRange } from "@/lib/tenure";
import { formatDateTime } from "@/lib/time";
import { FeedbackReview } from "./feedback-review";

export const metadata: Metadata = { title: "Suggestions & feedback" };

/** Enough to hold a term's worth; older ones are in the audit log. */
const LIMIT = 200;

export default async function FeedbackAdminPage({ searchParams }: PageProps<"/admin/feedback">) {
  await requireCapPage("feedback.manage");
  // What members raised during the tenure being looked at, or one month of it.
  const tenure = await selectedTenure();
  const range = tenure ? tenureRange(tenure) : null;
  const months = tenure ? tenureMonthKeys(tenure) : [];
  const sp = await searchParams;
  const month = typeof sp.m === "string" && months.includes(sp.m) ? sp.m : "";
  const picked = month ? monthWindow(month) : range;
  const rows = await db
    .select({ f: feedback, name: member.fullName })
    .from(feedback)
    .innerJoin(member, eq(member.id, feedback.memberId))
    .where(
      and(
        picked ? gte(feedback.createdAt, picked.from) : undefined,
        picked ? lt(feedback.createdAt, picked.to) : undefined,
      ),
    )
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
      <MonthFilter
        className="mb-4"
        value={month}
        months={monthOptions(months)}
        allLabel="Whole tenure"
        href={(key) => (key ? `/admin/feedback?m=${key}` : "/admin/feedback")}
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
