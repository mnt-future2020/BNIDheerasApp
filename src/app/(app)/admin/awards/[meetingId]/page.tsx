import { and, asc, eq, ne } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { award, awardType, meeting, member } from "@/db/schema";
import { ensureDefaults } from "@/lib/defaults";
import { requireCapPage } from "@/lib/session";
import { formatDate, formatTime } from "@/lib/time";
import { AwardsEditor } from "../awards-editor";

export const metadata: Metadata = { title: "Weekly recognitions" };

/** One meeting's winners, opened from the list of meetings. */
export default async function AwardsForMeetingPage({ params }: PageProps<"/admin/awards/[meetingId]">) {
  await requireCapPage("awards.manage");
  await ensureDefaults();
  const { meetingId } = await params;
  const [m] = await db.select().from(meeting).where(eq(meeting.id, meetingId));
  if (!m) notFound();

  const [types, members, existing] = await Promise.all([
    db.select().from(awardType).where(eq(awardType.isActive, true)).orderBy(asc(awardType.sortOrder)),
    db
      .select({ id: member.id, name: member.fullName })
      .from(member)
      .where(and(ne(member.status, "inactive"), eq(member.isChapterMember, true)))
      .orderBy(asc(member.fullName)),
    db.select().from(award).where(eq(award.meetingId, m.id)),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title={`Recognitions · ${formatDate(m.startsAt)}`}
        back={{ href: "/admin/awards", label: "Recognitions" }}
        description={`${m.title} · ${formatTime(m.startsAt)}`}
      />
      <AwardsEditor
        // Starts over when the saved winners change (e.g. after Delete).
        key={existing.map((e) => `${e.awardTypeId}=${e.memberId}`).join(",")}
        meetingId={m.id}
        types={types.map((t) => ({
          id: t.id,
          name: t.name,
          noteEnabled: t.noteEnabled,
          valueEnabled: t.valueEnabled,
          valueHint: t.valueHint,
        }))}
        members={members}
        initial={existing.map((e) => ({
          awardTypeId: e.awardTypeId,
          memberId: e.memberId,
          note: e.note ?? "",
          value: e.value ?? "",
          published: e.published,
        }))}
      />
    </PageContainer>
  );
}
