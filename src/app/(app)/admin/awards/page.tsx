import { and, count, desc, gte, lt, lte, ne, sql } from "drizzle-orm";
import { ChevronRightIcon, TrophyIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MonthFilter } from "@/components/month-filter";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { award, meeting } from "@/db/schema";
import { ensureDefaults } from "@/lib/defaults";
import { monthOf, monthOptions } from "@/lib/months";
import { requireCapPage } from "@/lib/session";
import { selectedTenure, tenureRange } from "@/lib/tenure";
import { daysFromNow, formatDate, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Weekly recognitions" };

export default async function AwardsAdminPage({ searchParams }: PageProps<"/admin/awards">) {
  await requireCapPage("awards.manage");
  await ensureDefaults();
  const tenure = await selectedTenure();
  const range = tenure ? tenureRange(tenure) : null;
  const meetings = await db
    .select({ id: meeting.id, title: meeting.title, startsAt: meeting.startsAt })
    .from(meeting)
    .where(
      and(
        lte(meeting.startsAt, daysFromNow(1)),
        ne(meeting.status, "cancelled"),
        range ? gte(meeting.startsAt, range.from) : undefined,
        range ? lt(meeting.startsAt, range.to) : undefined,
      ),
    )
    .orderBy(desc(meeting.startsAt))
    .limit(52);

  // What each meeting already has, so the list says where to pick up.
  const saved = await db
    .select({
      meetingId: award.meetingId,
      n: count(),
      published: sql<number>`count(*) filter (where ${award.published})::int`,
    })
    .from(award)
    .groupBy(award.meetingId);
  const stateOf = new Map(saved.map((s) => [s.meetingId, s]));

  const { month: monthParam } = await searchParams;
  const months = [...new Set(meetings.map((m) => monthOf(m.startsAt)))];
  const month = typeof monthParam === "string" && months.includes(monthParam) ? monthParam : (months[0] ?? "");
  const shown = meetings.filter((m) => monthOf(m.startsAt) === month);

  return (
    <PageContainer>
      <PageHeader
        title="Weekly recognitions"
        back={{ href: "/admin", label: "Admin" }}
        description="Open a meeting to pick its winners. Save a draft during the meeting, publish when announced."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/awards/leaderboard">
              <TrophyIcon /> Leaderboard
            </Link>
          </Button>
        }
      />
      {meetings.length === 0 ? (
        <EmptyState title="No meetings yet.">Create a meeting first.</EmptyState>
      ) : (
        <div className="space-y-3">
          <MonthFilter value={month} months={monthOptions(months)} href={(key) => `/admin/awards?month=${key}`} />
          <div className="divide-y rounded-xl border bg-card">
            {shown.map((m) => {
              const s = stateOf.get(m.id);
              return (
                <Link
                  key={m.id}
                  href={`/admin/awards/${m.id}`}
                  className="flex items-center gap-3 px-4 py-3 first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{formatDate(m.startsAt)}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatTime(m.startsAt)} · {m.title}
                    </div>
                  </div>
                  {!s ? (
                    <Badge variant="outline">Not picked</Badge>
                  ) : s.published ? (
                    <Badge>Published</Badge>
                  ) : (
                    <Badge variant="secondary">Draft · {s.n}</Badge>
                  )}
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
