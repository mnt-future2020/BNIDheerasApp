import { and, count, desc, eq, gte, lt } from "drizzle-orm";
import type { Metadata } from "next";
import { FeedbackStatusBadge } from "@/components/feedback-status";
import { MonthFilter } from "@/components/month-filter";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { feedback } from "@/db/schema";
import { monthOptions, monthWindow, tenureMonthKeys } from "@/lib/months";
import { pageFromParam, pageHref, paginate } from "@/lib/pagination";
import { requireMember } from "@/lib/session";
import { selectedTenure, tenureRange } from "@/lib/tenure";
import { formatDateTime } from "@/lib/time";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = { title: "Suggestions & feedback" };

const PAGE_SIZE = 10;

export default async function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  const me = await requireMember();
  // Only what this member raised during the tenure being looked at, narrowed
  // to one of its months when one is picked — the same filter as every other list.
  const sp = await searchParams;
  const tenure = await selectedTenure();
  const months = tenure ? tenureMonthKeys(tenure) : [];
  const month = typeof sp.m === "string" && months.includes(sp.m) ? sp.m : "";
  const window = month ? monthWindow(month) : tenure ? tenureRange(tenure) : null;
  const mine = and(
    eq(feedback.memberId, me.id),
    window ? gte(feedback.createdAt, window.from) : undefined,
    window ? lt(feedback.createdAt, window.to) : undefined,
  );
  const [{ total }] = await db.select({ total: count() }).from(feedback).where(mine);
  const { page, pageCount, offset } = paginate(pageFromParam(sp.page), total, PAGE_SIZE);
  const rows = await db.select().from(feedback).where(mine).orderBy(desc(feedback.createdAt)).limit(PAGE_SIZE).offset(offset);

  return (
    <PageContainer>
      <PageHeader title="Suggestions & feedback" description="Ideas and feedback go to the President, VP and Secretary." />
      <Card className="mb-6">
        <CardContent className="py-4">
          <FeedbackForm />
        </CardContent>
      </Card>

      <h2 className="mb-2 font-semibold">What you&apos;ve sent</h2>
      <MonthFilter
        className="mb-3"
        value={month}
        months={monthOptions(months)}
        allLabel="Whole tenure"
        path="/feedback"
      />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((f) => (
            <Card key={f.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {f.kind === "suggestion" ? "Suggestion" : "Feedback"} · {formatDateTime(f.createdAt)}
                  {f.anonymous ? " · name hidden" : ""}
                </CardTitle>
                <FeedbackStatusBadge status={f.status} />
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm whitespace-pre-line">{f.message}</p>
                {f.response ? (
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Head Table reply</div>
                    <p className="whitespace-pre-line">{f.response}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} href={(p) => pageHref("/feedback", { m: month || undefined }, p)} />
    </PageContainer>
  );
}
