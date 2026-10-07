import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { venue } from "@/db/schema";
import { getMeetingWithVenue } from "@/lib/attendance/queries";
import { requireAnyCapPage } from "@/lib/session";
import { formatDate, formatTime, toIstDateInput, toIstTimeInput } from "@/lib/time";
import { restoreMeeting } from "@/actions/meetings";
import { ConfirmButton } from "@/components/confirm-button";
import { PairScreenButton } from "@/components/pair-screen-button";
import { CopyQrLinkButton } from "@/components/qr-link-button";
import { MeetingForm } from "../meeting-form";

export const metadata: Metadata = { title: "Edit meeting" };

export default async function EditMeetingPage({ params }: PageProps<"/admin/meetings/[id]">) {
  // Reached by the LVH team and the Attendance Coordinator for the buttons at
  // the top; editing, cancelling and deleting stay with meetings.manage.
  const me = await requireAnyCapPage(["meetings.manage", "attendance.manual", "kiosk.run", "palms.view", "meeting.finalize"]);
  const canManage = me.caps.has("meetings.manage");
  const { id } = await params;
  const m = await getMeetingWithVenue(id);
  if (!m) notFound();
  const venues = await db.select({ id: venue.id, name: venue.name }).from(venue).where(eq(venue.isActive, true));
  const opensBefore = Math.round((m.startsAt.getTime() - m.checkinOpensAt.getTime()) / 60_000);

  return (
    <PageContainer>
      <PageHeader
        title={`${m.title} · ${formatDate(m.startsAt)}, ${formatTime(m.startsAt)}`}
        back={{ href: "/admin/meetings", label: "Meetings" }}
        actions={
          <>
            {m.status !== "cancelled" && me.caps.has("attendance.manual") ? (
              <Button asChild>
                <Link href={`/admin/meetings/${m.id}/palms`}>PALMS</Link>
              </Button>
            ) : null}
            {m.status !== "cancelled" && (me.caps.has("kiosk.run") || me.caps.has("meeting.finalize")) ? (
              <Button asChild variant="outline">
                {/* 0 visitors is an answer, so it shows; only "not entered" stays blank. */}
                <Link href={`/admin/meetings/${m.id}/visitors`}>
                  Visitors{m.visitorCount === null ? "" : ` · ${m.visitorCount}`}
                </Link>
              </Button>
            ) : null}
            {/* The only way in now that Attendance & PALMS is gone. */}
            {m.status !== "cancelled" && (me.caps.has("palms.view") || me.caps.has("meeting.finalize")) ? (
              <Button asChild variant="outline">
                <Link href={`/meetings/${m.id}/summary`}>Summary</Link>
              </Button>
            ) : null}
            {/* The LVH desk's two jobs, on the meeting they are run for. */}
            {m.status === "scheduled" && me.caps.has("kiosk.run") ? (
              <>
                <CopyQrLinkButton meetingId={m.id} />
                <PairScreenButton />
              </>
            ) : null}
            {canManage && m.status === "cancelled" && m.endsAt > new Date() ? (
              <ConfirmButton
                label="Restore"
                title="Restore this meeting?"
                description="It goes back on the schedule and check-in opens as usual."
                success="Meeting restored."
                action={restoreMeeting.bind(null, m.id)}
                variant="outline"
                size="default"
                destructive={false}
              />
            ) : null}
          </>
        }
      />
      {!canManage ? (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            {m.mode === "online" ? "Online meeting" : (venues.find((v) => v.id === m.venueId)?.name ?? "No venue")} ·{" "}
            {formatTime(m.startsAt)} – {formatTime(m.endsAt)}
            {m.status !== "scheduled" ? ` · ${m.status}` : ""}
          </CardContent>
        </Card>
      ) : m.status !== "scheduled" ? (
        <p className="rounded-lg bg-muted p-3 text-sm">
          This meeting is {m.status} and can no longer be edited.
          {m.status === "cancelled" && m.notes ? <> Reason: {m.notes}</> : null}
        </p>
      ) : (
        <Card>
          <CardContent className="py-4">
            <MeetingForm
              mode="edit"
              meetingId={m.id}
              venues={venues}
              initial={{
                title: m.title,
                kind: m.kind,
                mode: m.mode,
                venueId: m.venueId ?? "",
                date: toIstDateInput(m.startsAt),
                startTime: toIstTimeInput(m.startsAt),
                endTime: toIstTimeInput(m.endsAt),
                opensBeforeMin: String(opensBefore),
                closesAfterMin: m.checkinClosesAt ? String(Math.round((+m.checkinClosesAt - +m.startsAt) / 60_000)) : "",
                weeks: "1",
              }}
            />
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
