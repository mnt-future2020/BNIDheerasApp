import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberAvatar } from "@/components/member-avatar";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { award, awardType, meeting, member } from "@/db/schema";
import { requireMember } from "@/lib/session";
import { publicUrl } from "@/lib/storage";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Recognitions" };

/** One week's winners, opened from the list of weeks. */
export default async function AwardWeekPage({ params }: PageProps<"/awards/[meetingId]">) {
  await requireMember();
  const { meetingId } = await params;
  const [m] = await db.select().from(meeting).where(eq(meeting.id, meetingId));
  if (!m) notFound();
  const rows = await db
    .select({
      award: awardType.name,
      memberId: member.id,
      name: member.fullName,
      photoKey: member.photoKey,
      note: award.note,
      value: award.value,
    })
    .from(award)
    .innerJoin(awardType, eq(awardType.id, award.awardTypeId))
    .innerJoin(member, eq(member.id, award.memberId))
    .where(and(eq(award.meetingId, m.id), eq(award.published, true)))
    .orderBy(asc(awardType.sortOrder));
  // Nothing published for this week is the same as no such page for a member.
  if (rows.length === 0) notFound();

  return (
    <PageContainer>
      <PageHeader
        title={formatDate(m.startsAt)}
        back={{ href: "/awards", label: "Recognitions" }}
        description={m.title}
      />
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-2">
          {rows.map((r) => (
            <Link key={r.award} href={`/members/${r.memberId}`} className="flex items-center gap-3">
              <MemberAvatar name={r.name} src={publicUrl(r.photoKey)} />
              <div className="min-w-0 text-sm">
                <div className="text-xs text-muted-foreground">{r.award}</div>
                <div className="truncate font-medium">{r.name}</div>
                {r.value || r.note ? (
                  <div className="truncate text-xs text-muted-foreground">{[r.value, r.note].filter(Boolean).join(" · ")}</div>
                ) : null}
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
