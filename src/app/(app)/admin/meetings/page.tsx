import { and, asc, count, desc, eq, gte, lt } from "drizzle-orm";
import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { restoreMeeting } from "@/actions/meetings";
import { ConfirmButton } from "@/components/confirm-button";
import { DeleteMeetingButton } from "@/components/delete-meeting-button";
import { MonthFilter } from "@/components/month-filter";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import { meeting, venue } from "@/db/schema";
import { type RecordCounts, recordCounts } from "@/lib/attendance/queries";
import { monthOptions, monthWindow, tenureMonthKeys } from "@/lib/months";
import { pageFromParam, pageHref, paginate } from "@/lib/pagination";
import { requireAnyCapPage } from "@/lib/session";
import { selectedTenure, tenureRange } from "@/lib/tenure";
import { addDays, formatDate, formatDateTime, formatTime, startOfIstDay } from "@/lib/time";
import { CancelMeetingButton } from "./[id]/cancel-button";
import type { MeetingFormValues } from "./meeting-form";
import { NewMeetingButton } from "./new-meeting-buttons";

export const metadata: Metadata = { title: "Meetings" };

const PAGE_SIZE = 10;

export default async function MeetingsAdminPage({ searchParams }: PageProps<"/admin/meetings">) {
  // The LVH team and the Attendance Coordinator come here for today's meeting —
  // to enter PALMS, take visitor details or open the live board. Only
  // meetings.manage sees the create, cancel and delete controls.
  const me = await requireAnyCapPage(["meetings.manage", "attendance.manual", "kiosk.run", "palms.view", "meeting.finalize"]);
  const canManage = me.caps.has("meetings.manage");
  const canRemove = me.caps.has("meetings.remove");
  const sp = await searchParams;
  const now = new Date();
  // Everything on this page belongs to the tenure picked in the header.
  const tenure = await selectedTenure();
  const inTenure = tenure
    ? and(gte(meeting.startsAt, tenureRange(tenure).from), lt(meeting.startsAt, tenureRange(tenure).to))
    : undefined;
  // Upcoming and Past can be narrowed to one month of the tenure; Today is today.
  const months = tenure ? tenureMonthKeys(tenure) : [];
  const month = typeof sp.m === "string" && months.includes(sp.m) ? sp.m : "";
  const inMonth = month
    ? and(gte(meeting.startsAt, monthWindow(month).from), lt(meeting.startsAt, monthWindow(month).to))
    : undefined;
  const isUpcoming = and(inTenure, inMonth, gte(meeting.endsAt, now), eq(meeting.status, "scheduled"));
  const isPast = and(inTenure, inMonth, lt(meeting.endsAt, now));
  // "Today" is the IST calendar day, so a 7 AM meeting stays listed all day.
  const dayStart = startOfIstDay(now);
  const isToday = and(inTenure, gte(meeting.startsAt, dayStart), lt(meeting.startsAt, addDays(dayStart, 1)));
  const [[{ upcomingTotal }], [{ pastTotal }]] = await Promise.all([
    db.select({ upcomingTotal: count() }).from(meeting).where(isUpcoming),
    db.select({ pastTotal: count() }).from(meeting).where(isPast),
  ]);
  const up = paginate(pageFromParam(sp.page), upcomingTotal, PAGE_SIZE);
  const pa = paginate(pageFromParam(sp.pp), pastTotal, PAGE_SIZE);
  const withVenue = { meeting, venueName: venue.name };
  const [today, upcoming, past, cancelled, venues] = await Promise.all([
    db
      .select(withVenue)
      .from(meeting)
      .leftJoin(venue, eq(venue.id, meeting.venueId))
      .where(isToday)
      .orderBy(asc(meeting.startsAt)),
    db
      .select(withVenue)
      .from(meeting)
      .leftJoin(venue, eq(venue.id, meeting.venueId))
      .where(isUpcoming)
      .orderBy(asc(meeting.startsAt))
      .limit(PAGE_SIZE)
      .offset(up.offset),
    db
      .select(withVenue)
      .from(meeting)
      .leftJoin(venue, eq(venue.id, meeting.venueId))
      .where(isPast)
      .orderBy(desc(meeting.startsAt))
      .limit(PAGE_SIZE)
      .offset(pa.offset),
    db
      .select(withVenue)
      .from(meeting)
      .leftJoin(venue, eq(venue.id, meeting.venueId))
      .where(and(inTenure, gte(meeting.endsAt, now), eq(meeting.status, "cancelled")))
      .orderBy(asc(meeting.startsAt))
      .limit(30),
    db.select({ id: venue.id, name: venue.name }).from(venue).where(eq(venue.isActive, true)),
  ]);
  // Delete needs to know what is attached to each meeting it offers to delete.
  const counts = await recordCounts([...today, ...upcoming, ...past, ...cancelled].map((c) => c.meeting.id));

  // Nothing is filled in ahead of time: a meeting is created from what is typed
  // now, never from last week's values sitting in the boxes.
  const blank: MeetingFormValues = {
    title: "",
    kind: "",
    mode: "",
    venueId: "",
    date: "",
    startTime: "",
    endTime: "",
    opensBeforeMin: "",
    closesAfterMin: "",
  };
  // Each list keeps the other's page in its links.
  const keep = (p: number) => (p > 1 ? String(p) : undefined);
  // Land on today's meeting when there is one: that's what the day needs.
  const tab = sp.tab === "past" ? "past" : sp.tab === "upcoming" ? "upcoming" : today.length ? "today" : "upcoming";

  return (
    <PageContainer>
      <PageHeader
        title="Meetings"
        back={{ href: "/admin", label: "Admin" }}
        actions={
          canManage ? <NewMeetingButton venues={venues} blank={blank} /> : null
        }
      />
      {canManage && venues.length === 0 ? (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          No venues yet. Open <b>Create meeting</b> and add one with the <b>+</b> next to the Venue box.
        </p>
      ) : null}
      <Tabs defaultValue={tab}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>
          {/* Narrowing to a month starts both lists again from page one. */}
          <MonthFilter
            value={month}
            months={monthOptions(months)}
            allLabel="All months"
            path="/admin/meetings"
            params={{ tab }}
          />
        </div>
        <TabsContent value="today">
          {today.length === 0 ? (
            <EmptyState title="No meeting today." />
          ) : (
            <MeetingRows rows={today} counts={counts} canRemove={canRemove} showStatus />
          )}
        </TabsContent>
        <TabsContent value="upcoming">
          {upcoming.length === 0 ? (
            <EmptyState title="No upcoming meetings.">Create the weekly meeting to get started.</EmptyState>
          ) : (
            <MeetingRows rows={upcoming} counts={counts} canRemove={canRemove} />
          )}
          <Pagination
            page={up.page}
            pageCount={up.pageCount}
            total={upcomingTotal}
            pageSize={PAGE_SIZE}
            // Keeps the tab: without it, paging lands back on Today whenever there is a meeting today.
            href={(p) => pageHref("/admin/meetings", { tab: "upcoming", m: month || undefined, pp: keep(pa.page) }, p)}
          />
          {canRemove && cancelled.length ? (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Cancelled</h2>
              <div className="divide-y rounded-xl border bg-card">
                {cancelled.map(({ meeting: m, venueName }) => (
                  <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <div className="font-medium line-through decoration-muted-foreground/60">{m.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(m.startsAt)} · {m.mode === "online" ? "Online" : (venueName ?? "No venue")}
                        {m.notes ? ` · ${m.notes}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <ConfirmButton
                        label="Restore"
                        title="Restore this meeting?"
                        description="It goes back on the schedule and check-in opens as usual."
                        success="Meeting restored."
                        action={restoreMeeting.bind(null, m.id)}
                        destructive={false}
                      />
                      <DeleteMeetingButton
                        meetingId={m.id}
                        when={`${formatDate(m.startsAt)} · ${formatTime(m.startsAt)}`}
                        {...counts.get(m.id)!}
                        finalized={false}
                        size="sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="past">
          {past.length === 0 ? <EmptyState title="No past meetings yet." /> : <MeetingRows rows={past} counts={counts} canRemove={canRemove} showStatus />}
          <Pagination
            page={pa.page}
            pageCount={pa.pageCount}
            total={pastTotal}
            pageSize={PAGE_SIZE}
            href={(p) => pageHref("/admin/meetings", { tab: "past", m: month || undefined, page: keep(up.page) }, p, "pp")}
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

/**
 * Meetings as compact rows. The row opens the meeting; cancelling and deleting
 * are icons beside it, so neither needs the meeting's own page. They sit
 * outside the link — a button inside one can't be tapped on its own.
 */
function MeetingRows({
  rows,
  counts,
  canRemove,
  showStatus,
}: {
  rows: { meeting: typeof meeting.$inferSelect; venueName: string | null }[];
  counts: Map<string, RecordCounts>;
  /** Cancel and delete: held apart from editing, so a scheduler can't call one off. */
  canRemove: boolean;
  showStatus?: boolean;
}) {
  return (
    <div className="divide-y rounded-xl border bg-card">
      {rows.map(({ meeting: m, venueName }) => (
        <div key={m.id} className="flex items-center gap-1 pr-2 first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50">
          <Link href={`/admin/meetings/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{m.title}</div>
              <div className="text-sm text-muted-foreground">
                {formatDateTime(m.startsAt)} – {formatTime(m.endsAt)} ·{" "}
                {m.mode === "online" ? "Online" : (venueName ?? "No venue")}
              </div>
            </div>
            {showStatus ? (
              <Badge variant={m.status === "finalized" ? "secondary" : m.status === "cancelled" ? "destructive" : "outline"}>
                {m.status}
              </Badge>
            ) : null}
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
          </Link>
          {canRemove ? (
            <>
              {m.status === "scheduled" ? <CancelMeetingButton id={m.id} iconOnly /> : null}
              <DeleteMeetingButton
                meetingId={m.id}
                when={`${formatDate(m.startsAt)} · ${formatTime(m.startsAt)}`}
                {...counts.get(m.id)!}
                finalized={m.status === "finalized"}
                iconOnly
              />
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}

