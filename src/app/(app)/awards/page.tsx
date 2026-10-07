import { and, count, desc, eq, gte, lt } from "drizzle-orm";
import { ChevronRightIcon, TrophyIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { award, meeting } from "@/db/schema";
import { requireMember } from "@/lib/session";
import { selectedTenure, tenureRange } from "@/lib/tenure";
import { formatDate, formatMonth, istToDate, toIstDateInput } from "@/lib/time";
import { MonthFilter } from "./month-filter";

export const metadata: Metadata = { title: "Recognitions" };

export default async function AwardsPage({ searchParams }: PageProps<"/awards">) {
  await requireMember();
  const tenure = await selectedTenure();
  const range = tenure ? tenureRange(tenure) : null;

  // The weeks that have recognitions, newest first: this page is the list, and
  // a week's winners are on its own page.
  const weeks = await db
    .select({ id: meeting.id, title: meeting.title, date: meeting.startsAt, items: count(award.id) })
    .from(award)
    .innerJoin(meeting, eq(meeting.id, award.meetingId))
    .where(
      range
        ? and(eq(award.published, true), gte(meeting.startsAt, range.from), lt(meeting.startsAt, range.to))
        : eq(award.published, true),
    )
    .groupBy(meeting.id, meeting.title, meeting.startsAt)
    .orderBy(desc(meeting.startsAt));

  const { month: monthParam } = await searchParams;
  const months = [...new Set(weeks.map((w) => toIstDateInput(w.date).slice(0, 7)))];
  const month = typeof monthParam === "string" && months.includes(monthParam) ? monthParam : "";
  const shown = month ? weeks.filter((w) => toIstDateInput(w.date).startsWith(month)) : weeks;

  return (
    <PageContainer>
      <PageHeader
        title="Weekly recognitions"
        description="Chosen each week by the Head Table. Open a week to see its winners."
        actions={
          <Button asChild variant="outline">
            <Link href="/awards/leaderboard">
              <TrophyIcon /> Leaderboard
            </Link>
          </Button>
        }
      />
      {weeks.length === 0 ? (
        <EmptyState title="No recognitions published yet." />
      ) : (
        <div className="space-y-3">
          <MonthFilter
            month={month}
            months={months.map((key) => ({ key, label: formatMonth(istToDate(`${key}-01`)) }))}
          />
          {shown.length === 0 ? (
            <EmptyState title="No recognitions that month." />
          ) : (
            <div className="divide-y rounded-xl border bg-card">
              {shown.map((w) => (
                <Link
                  key={w.id}
                  href={`/awards/${w.id}`}
                  className="flex items-center gap-3 px-4 py-3 first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{formatDate(w.date)}</div>
                    <div className="text-sm text-muted-foreground">
                      {w.title} · {w.items} recognition{w.items === 1 ? "" : "s"}
                    </div>
                  </div>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
