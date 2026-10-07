import { and, asc, count, eq, gte, lt } from "drizzle-orm";
import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { db } from "@/db";
import { CALENDAR_KINDS, calendarEvent, member, RETIRED_CALENDAR_KINDS } from "@/db/schema";
import { kindLabel } from "@/lib/calendar";
import { pageFromParam, pageHref, paginate } from "@/lib/pagination";
import { requireCapPage } from "@/lib/session";
import { selectedTenure, tenureRange } from "@/lib/tenure";
import { daysFromNow, toIstDateInput } from "@/lib/time";
import { CalendarAdmin } from "./calendar-admin";

export const metadata: Metadata = { title: "Manage events" };

const PAGE_SIZE = 15;

export default async function CalendarAdminPage({ searchParams }: PageProps<"/admin/calendar">) {
  await requireCapPage("calendar.manage");

  // The tenure being looked at; within it, upcoming items and last week's.
  const tenure = await selectedTenure();
  const range = tenure ? tenureRange(tenure) : null;
  const shown = and(
    gte(calendarEvent.endsAt, daysFromNow(-7)),
    range ? gte(calendarEvent.startsAt, range.from) : undefined,
    range ? lt(calendarEvent.startsAt, range.to) : undefined,
  );
  const [{ total }] = await db.select({ total: count() }).from(calendarEvent).where(shown);
  const { page, pageCount, offset } = paginate(pageFromParam((await searchParams).page), total, PAGE_SIZE);
  const [events, members, used] = await Promise.all([
    db.select().from(calendarEvent).where(shown).orderBy(asc(calendarEvent.startsAt)).limit(PAGE_SIZE).offset(offset),
    db.select({ id: member.id, name: member.fullName }).from(member).where(and(eq(member.status, "active"), eq(member.isChapterMember, true))).orderBy(asc(member.fullName)),
    // Types the chapter made up stay on the list as long as something uses one.
    db.selectDistinct({ kind: calendarEvent.kind }).from(calendarEvent),
  ]);
  const kinds = [
    ...new Set([...CALENDAR_KINDS, ...used.map((u) => u.kind).filter((k) => !RETIRED_CALENDAR_KINDS.includes(k))]),
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Manage events"
        back={{ href: "/admin", label: "Admin" }}
        description="Weekly meetings appear automatically. Add feature presentations and education slots here."
      />
      <CalendarAdmin
        kinds={kinds.map((k) => ({ key: k, label: kindLabel(k) }))}
        // Retired types are named too, so older events keep reading properly.
        labels={Object.fromEntries(
          [...new Set([...CALENDAR_KINDS, ...used.map((u) => u.kind)])].map((k) => [k, kindLabel(k)]),
        )}
        members={members}
        events={events.map((e) => ({
          id: e.id,
          kind: e.kind,
          title: e.title,
          description: e.description ?? "",
          date: toIstDateInput(e.startsAt),
          location: e.location ?? "",
          memberId: e.memberId ?? "",
        }))}
      />
      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={PAGE_SIZE}
        href={(p) => pageHref("/admin/calendar", {}, p)}
      />
    </PageContainer>
  );
}
