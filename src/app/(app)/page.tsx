import { and, asc, count, desc, eq, gte, lt } from "drizzle-orm";
import { CakeIcon, CalendarIcon, ClockIcon, MapPinIcon, ScanLineIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { CelebrationRow } from "@/components/celebration-row";
import { DeviceCard } from "@/components/device-card";
import { InstallAppCard } from "@/components/install-app-card";
import { MemberAvatar } from "@/components/member-avatar";
import { PageContainer } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { award, awardType, calendarEvent, leaveRequest, meeting, member } from "@/db/schema";
import { getCurrentOrNextMeeting, memberMeetingState } from "@/lib/attendance/queries";
import { checkinClosingTime, checkinWindow, planDeadline } from "@/lib/attendance/rules";
import { type Celebration, getCelebrations, isToday, MONTH_NAMES, nextMonth, today } from "@/lib/celebrations";
import { getMemberDevices } from "@/lib/devices";
import { requireMember } from "@/lib/session";
import { accountName } from "@/lib/settings";
import { publicUrl } from "@/lib/storage";
import { selectedTenure, tenureRange } from "@/lib/tenure";
import { formatDate, formatDateTime, formatShortDate, formatTime } from "@/lib/time";
import { CancelPlanButton, PlanDialog } from "./plan-dialog";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const me = await requireMember();
  const { denied } = await searchParams;
  const [devices, next] = await Promise.all([getMemberDevices(me.id), getCurrentOrNextMeeting()]);
  const state = next ? await memberMeetingState(me.id, next.id) : null;
  // The cards that list what happened follow the tenure picked in the header,
  // like every other page. Checking in and the next meeting are about today,
  // so they stay put: switching the view can't change what you may do now.
  const tenure = await selectedTenure();
  const range = tenure ? tenureRange(tenure) : null;
  const winners = await latestWinners(range);
  const upcoming = await db
    .select()
    .from(calendarEvent)
    .where(
      range
        ? and(
            gte(calendarEvent.endsAt, new Date()),
            gte(calendarEvent.startsAt, range.from),
            lt(calendarEvent.startsAt, range.to),
          )
        : gte(calendarEvent.endsAt, new Date()),
    )
    .orderBy(asc(calendarEvent.startsAt))
    .limit(3);

  const celebrations = await getCelebrations();
  const now0 = today();

  // No device-approval count here: pending phones are handled on the members desk.
  const pendingLeave = me.caps.has("leave.approve")
    ? (await db.select({ n: count() }).from(leaveRequest).where(eq(leaveRequest.status, "pending")))[0].n
    : 0;

  const now = new Date();
  const windowState = next ? checkinWindow(now, next.checkinOpensAt, checkinClosingTime(next)) : null;
  // Until this moment a member can still cancel a plan or give a reason; the
  // server enforces the same deadline, so the buttons must agree with it.
  const canPlan = next ? now < planDeadline(next) : false;
  // The admin-only account greets by the Chapter Admin's name from Settings,
  // in full: it isn't a person's record, so "Hello, Chapter" reads oddly.
  const firstName = me.isChapterMember ? me.fullName.split(" ")[0] : await accountName(me);

  return (
    <PageContainer>
      {denied ? (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">You don&apos;t have access to that page.</p>
      ) : null}
      <h1 className="mb-4 text-2xl font-bold">Hello, {firstName}</h1>

      <div className="space-y-4">
        {/* Right under the greeting; shows only where the app can be installed. */}
        <InstallAppCard />
        {pendingLeave > 0 ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-wrap gap-2 py-3 text-sm">
              <span className="font-medium">Waiting for you:</span>
              <Link className="text-primary underline" href="/admin/leave">
                {pendingLeave} medical leave request{pendingLeave > 1 ? "s" : ""}
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {celebrations ? <CelebrationsCard all={celebrations} now={now0} /> : null}

        {me.isChapterMember ? <DeviceCard memberId={me.id} devices={devices} /> : null}

        {me.isChapterMember ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-muted-foreground">Next meeting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {next ? (
                <>
                  <div>
                    <div className="text-lg font-semibold">{next.title}</div>
                    <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <CalendarIcon className="size-4" /> {formatDate(next.startsAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ClockIcon className="size-4" /> {formatTime(next.startsAt)} – {formatTime(next.endsAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPinIcon className="size-4" />
                        {next.mode === "online" ? "Online meeting" : (next.venue?.name ?? "Venue to be announced")}
                      </span>
                    </div>
                  </div>

                  {state?.attendance ? (
                    <div className="flex items-center gap-2 text-sm">
                      <StatusBadge status={state.attendance.status} full />
                      {state.attendance.checkedInAt ? (
                        <span className="text-muted-foreground">at {formatTime(state.attendance.checkedInAt)}</span>
                      ) : null}
                    </div>
                  ) : state?.substitute ? (
                    <div className="flex items-center justify-between rounded-lg bg-violet-50 px-3 py-2 text-sm">
                      <span>
                        Substitute: <b>{state.substitute.name}</b>
                        {state.substitute.arrivedAt ? " · arrived" : ""}
                      </span>
                      {canPlan ? <CancelPlanButton meetingId={next.id} /> : null}
                    </div>
                  ) : state?.leave ? (
                    <div className="flex items-center justify-between rounded-lg bg-sky-50 px-3 py-2 text-sm">
                      <span>
                        {state.leave.kind === "medical" ? "Medical leave" : "Informed absence"} ·{" "}
                        <b>{state.leave.status}</b>
                      </span>
                      {canPlan ? <CancelPlanButton meetingId={next.id} /> : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {windowState === "open" && !state?.attendance ? (
                      <Button asChild size="lg" className="h-12 flex-1 text-base">
                        <Link href="/scan">
                          <ScanLineIcon /> Scan to check in
                        </Link>
                      </Button>
                    ) : windowState === "not_open_yet" ? (
                      <p className="flex-1 text-sm text-muted-foreground">
                        Check-in opens at {formatDateTime(next.checkinOpensAt)}.
                      </p>
                    ) : null}
                    {canPlan && !state?.attendance ? <PlanDialog meetingId={next.id} /> : null}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No meeting scheduled yet.</p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {winners ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrophyIcon className="size-4 text-primary" /> Recognitions · {formatShortDate(winners.date)}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {winners.rows.map((w) => (
                <div key={w.award} className="flex items-center gap-3">
                  <MemberAvatar name={w.name} src={publicUrl(w.photoKey)} />
                  <div className="min-w-0 text-sm">
                    <div className="text-xs text-muted-foreground">{w.award}</div>
                    <div className="truncate font-medium">{w.name}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {upcoming.length ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Coming up</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcoming.map((e) => (
                <Link key={e.id} href="/calendar" className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{e.title}</span>
                  <span className="shrink-0 text-muted-foreground">{formatDate(e.startsAt)}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PageContainer>
  );
}

/**
 * Only the recognitions published most recently — by when they were published,
 * not by meeting date, so entering a new week always replaces what is on the
 * home screen even if an older week is filled in afterwards. Within the tenure
 * being looked at, so this agrees with the Recognitions page.
 */
async function latestWinners(range: { from: Date; to: Date } | null) {
  const published = eq(award.published, true);
  const [latest] = await db
    .select({ meetingId: meeting.id, date: meeting.startsAt })
    .from(award)
    .innerJoin(meeting, eq(meeting.id, award.meetingId))
    .where(range ? and(published, gte(meeting.startsAt, range.from), lt(meeting.startsAt, range.to)) : published)
    .orderBy(desc(award.updatedAt))
    .limit(1);
  if (!latest) return null;
  const rows = await db
    .select({ award: awardType.name, name: member.fullName, photoKey: member.photoKey })
    .from(award)
    .innerJoin(awardType, eq(awardType.id, award.awardTypeId))
    .innerJoin(member, eq(member.id, award.memberId))
    .where(and(eq(award.meetingId, latest.meetingId), eq(award.published, true)))
    .orderBy(asc(awardType.sortOrder));
  return { date: latest.date, rows };
}

const CARD_LIMIT = 6;

function CelebrationsCard({ all, now }: { all: Celebration[]; now: ReturnType<typeof today> }) {
  const coming = nextMonth(now.month);
  const thisMonth = all.filter((c) => c.month === now.month);
  // Today's and the rest of the month's first; days already gone are on the Celebrations page.
  const stillToCome = thisMonth.filter((c) => c.day >= now.day || isToday(c, now));
  const shownThisMonth = stillToCome.slice(0, CARD_LIMIT);
  const nextOnes = all.filter((c) => c.month === coming);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CakeIcon className="size-4 text-primary" /> Celebrations
        </CardTitle>
        <Link href="/celebrations" className="text-sm text-primary underline">
          See all
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground uppercase">This month · {MONTH_NAMES[now.month - 1]}</div>
          {shownThisMonth.length ? (
            shownThisMonth.map((c) => <CelebrationRow key={`${c.memberId}-${c.kind}`} c={c} today={isToday(c, now)} />)
          ) : (
            <p className="text-sm text-muted-foreground">
              {thisMonth.length ? "No more this month." : "No birthdays or anniversaries this month."}
            </p>
          )}
          {thisMonth.length > shownThisMonth.length ? (
            <Link href="/celebrations" className="mt-1 block text-sm text-primary underline">
              +{thisMonth.length - shownThisMonth.length} more this month
            </Link>
          ) : null}
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground uppercase">Coming up · {MONTH_NAMES[coming - 1]}</div>
          {nextOnes.length ? (
            nextOnes.slice(0, CARD_LIMIT).map((c) => <CelebrationRow key={`${c.memberId}-${c.kind}`} c={c} today={false} />)
          ) : (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          )}
          {nextOnes.length > CARD_LIMIT ? (
            <Link href="/celebrations" className="mt-1 block text-sm text-primary underline">
              +{nextOnes.length - CARD_LIMIT} more
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
