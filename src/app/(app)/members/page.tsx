import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { member } from "@/db/schema";
import { requireMember } from "@/lib/session";
import { selectedTenure } from "@/lib/tenure";
import { publicUrl } from "@/lib/storage";
import { Directory } from "./directory";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  await requireMember();
  // Someone who joined after a tenure ended wasn't in the chapter then, so they
  // don't appear while that tenure is being looked at.
  const tenure = await selectedTenure();
  const rows = await db
    .select({
      id: member.id,
      name: member.fullName,
      business: member.businessName,
      category: member.category,
      photoKey: member.photoKey,
    })
    .from(member)
    .where(
      and(
        eq(member.status, "active"),
        eq(member.isChapterMember, true),
        tenure ? or(isNull(member.joinedOn), lte(member.joinedOn, tenure.endsOn)) : undefined,
      ),
    )
    .orderBy(asc(member.fullName));
  return (
    <PageContainer wide>
      <PageHeader
        title="Members"
        description={`${rows.length} members${tenure ? ` · ${tenure.name}` : " in BNI Dheeras"}`}
      />
      <Directory members={rows.map(({ photoKey, ...r }) => ({ ...r, photoUrl: publicUrl(photoKey) }))} />
    </PageContainer>
  );
}
