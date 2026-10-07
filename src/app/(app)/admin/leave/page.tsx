import { and, asc, count, desc, eq, gte, lt, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Metadata } from "next";
import { MonthFilter } from "@/components/month-filter";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { leaveRequest, meeting, member } from "@/db/schema";
import { monthOptions, monthWindow, tenureMonthKeys } from "@/lib/months";
import { pageFromParam, pageHref, paginate } from "@/lib/pagination";
import { requireCapPage } from "@/lib/session";
import { selectedTenure } from "@/lib/tenure";
import { formatDate, formatDateTime } from "@/lib/time";
import { ChangeLeaveDecision, LeaveDecision } from "./leave-decision";

export const metadata: Metadata = { title: "Medical leave" };

const PAGE_SIZE = 20;
const decider = alias(member, "decider");

export default async function LeavePage({ searchParams }: PageProps<"/admin/leave">) {
  await requireCapPage("leave.approve");
  const sp = await searchParams;
  // Pending requests always show, however old: they are waiting on a decision.
  // The decisions below them can be narrowed to one month of the tenure.
  const tenure = await selectedTenure();
  const months = tenure ? tenureMonthKeys(tenure) : [];
  const month = typeof sp.m === "string" && months.includes(sp.m) ? sp.m : "";
  const picked = month ? monthWindow(month) : null;
  const medical = eq(leaveRequest.kind, "medical");
  const decidedWhere = and(
    medical,
    ne(leaveRequest.status, "pending"),
    picked ? gte(meeting.startsAt, picked.from) : undefined,
    picked ? lt(meeting.startsAt, picked.to) : undefined,
  );
  const [pending, [{ total }]] = await Promise.all([
    // Every pending request, however old, oldest first.
    db
      .select({ leave: leaveRequest, name: member.fullName, meetingTitle: meeting.title, startsAt: meeting.startsAt })
      .from(leaveRequest)
      .innerJoin(member, eq(member.id, leaveRequest.memberId))
      .innerJoin(meeting, eq(meeting.id, leaveRequest.meetingId))
      .where(and(medical, eq(leaveRequest.status, "pending")))
      .orderBy(asc(meeting.startsAt)),
    db
      .select({ total: count() })
      .from(leaveRequest)
      .innerJoin(meeting, eq(meeting.id, leaveRequest.meetingId))
      .where(decidedWhere),
  ]);
  const { page, pageCount, offset } = paginate(pageFromParam(sp.page), total, PAGE_SIZE);
  const decided = await db
    .select({
      leave: leaveRequest,
      name: member.fullName,
      startsAt: meeting.startsAt,
      meetingStatus: meeting.status,
      deciderName: decider.fullName,
    })
    .from(leaveRequest)
    .innerJoin(member, eq(member.id, leaveRequest.memberId))
    .innerJoin(meeting, eq(meeting.id, leaveRequest.meetingId))
    .leftJoin(decider, eq(decider.id, leaveRequest.decidedById))
    .where(decidedWhere)
    .orderBy(desc(leaveRequest.decidedAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  return (
    <PageContainer>
      <PageHeader
        title="Medical leave"
        back={{ href: "/admin", label: "Admin" }}
        description="Approved medical leave is recorded as M (not an absence) when the meeting is finalized."
      />
      {pending.length === 0 ? (
        <EmptyState title="No pending requests." />
      ) : (
        <div className="space-y-2">
          {pending.map((r) => (
            <Card key={r.leave.id}>
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {r.meetingTitle} · {formatDate(r.startsAt)}
                  </div>
                  {r.leave.reason ? <div className="mt-1 text-sm">{r.leave.reason}</div> : null}
                </div>
                <LeaveDecision id={r.leave.id} name={r.name} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {months.length > 1 || decided.length ? (
        <>
          <div className="mt-8 mb-2 flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Decisions</h2>
            <MonthFilter
              value={month}
              months={monthOptions(months)}
              allLabel="All months"
              path="/admin/leave"
            />
          </div>
          {decided.length === 0 ? <EmptyState title="No decisions that month." /> : null}
          <div className="divide-y rounded-xl border text-sm">
            {decided.map((r) => (
              <div key={r.leave.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <div className="min-w-0">
                  <div>
                    {r.name} · meeting {formatDate(r.startsAt)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.leave.reason ? `${r.leave.reason} · ` : ""}
                    {r.deciderName ? `by ${r.deciderName}` : ""}
                    {r.leave.decidedAt ? ` · ${formatDateTime(r.leave.decidedAt)}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={r.leave.status === "approved" ? "secondary" : "destructive"}>{r.leave.status}</Badge>
                  {r.meetingStatus === "scheduled" ? (
                    <ChangeLeaveDecision id={r.leave.id} name={r.name} approved={r.leave.status === "approved"} />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} href={(p) => pageHref("/admin/leave", { m: month || undefined }, p)} />
        </>
      ) : null}
    </PageContainer>
  );
}
