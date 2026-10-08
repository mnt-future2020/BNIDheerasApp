import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentOrNextMeeting, memberMeetingState } from "@/lib/attendance/queries";
import { planNotice } from "@/lib/attendance/rules";
import { getMemberDevices } from "@/lib/devices";
import { requireMember } from "@/lib/session";
import { formatDateTime, formatTime } from "@/lib/time";
import { ScanClient } from "./scan-client";

export const metadata: Metadata = { title: "Check in" };

/* The same one meeting as the home page, read the same way: what a member may
   do now can't depend on which screen they opened. */

export default async function ScanPage() {
  const me = await requireMember();
  if (!me.isChapterMember) {
    return (
      <PageContainer>
        <PageHeader title="Check in" />
        <p className="rounded-lg bg-muted p-4 text-sm">
          This is an admin account, not a chapter member, so it doesn&apos;t check in or appear in attendance.
        </p>
      </PageContainer>
    );
  }
  const [devices, meeting] = await Promise.all([getMemberDevices(me.id), getCurrentOrNextMeeting()]);
  const state = meeting ? await memberMeetingState(me.id, meeting.id) : null;
  const plan = state?.substitute ? ("substitute" as const) : (state?.leave?.kind ?? null);

  return (
    <PageContainer>
      <PageHeader
        title="Check in"
        description={
          meeting
            ? `${meeting.title} · ${formatDateTime(meeting.startsAt)}${meeting.venue ? ` · ${meeting.venue.name}` : ""}`
            : "No meeting is scheduled."
        }
      />
      {!meeting ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            There is nothing to check in to yet. The next meeting appears here as soon as it is scheduled.
          </CardContent>
        </Card>
      ) : state?.attendance ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 py-6 text-sm">
            <StatusBadge status={state.attendance.status} full />
            {state.attendance.checkedInAt ? (
              <span className="text-muted-foreground">
                Checked in at {formatTime(state.attendance.checkedInAt)}. Nothing more to do.
              </span>
            ) : (
              <span className="text-muted-foreground">Your attendance is already recorded.</span>
            )}
          </CardContent>
        </Card>
      ) : plan ? (
        // Down as away: the scanner would be inviting them to contradict what
        // the Head Table has on record.
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">{planNotice(plan)}</CardContent>
        </Card>
      ) : (
        <ScanClient memberId={me.id} devices={devices} />
      )}
    </PageContainer>
  );
}
