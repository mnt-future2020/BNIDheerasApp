import { asc, desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { device, member } from "@/db/schema";
import { requireCapPage } from "@/lib/session";
import { isFilter, MembersAdmin } from "./members-admin";

export const metadata: Metadata = { title: "Members" };

export default async function MembersAdminPage({ searchParams }: PageProps<"/admin/members">) {
  const me = await requireCapPage("members.manage");
  const { filter } = await searchParams;
  // The phone each member's Action list acts on: the one waiting for approval
  // if there is one, otherwise the approved phone. Newest first, so the first
  // pending row seen is the one they just registered.
  const canApproveDevices = me.caps.has("devices.approve");
  const phones = canApproveDevices
    ? await db
        .select({
          id: device.id,
          memberId: device.memberId,
          status: device.status,
          label: device.label,
          approvalCode: device.approvalCode,
        })
        .from(device)
        .where(inArray(device.status, ["pending", "approved"]))
        .orderBy(desc(device.createdAt))
    : [];
  const phoneOf = new Map<string, { id: string; status: "pending" | "approved"; label: string; code: string }>();
  for (const p of phones) {
    const held = phoneOf.get(p.memberId);
    if (held?.status === "pending") continue;
    if (p.status !== "pending" && p.status !== "approved") continue;
    phoneOf.set(p.memberId, { id: p.id, status: p.status, label: p.label, code: p.approvalCode });
  }
  const rows = await db
    .select({
      id: member.id,
      fullName: member.fullName,
      email: member.email,
      phone: member.phone,
      businessName: member.businessName,
      category: member.category,
      status: member.status,
      joinedOn: member.joinedOn,
      isAdmin: member.isAdmin,
      isChapterMember: member.isChapterMember,
    })
    .from(member)
    // Admin-only logins (isChapterMember false) belong to the app, not the
    // chapter roster: they're listed and toggled on /admin/roles instead.
    .where(eq(member.isChapterMember, true))
    .orderBy(asc(member.fullName));
  const members = rows.map((r) => ({ ...r, phoneDevice: phoneOf.get(r.id) ?? null }));
  return (
    <PageContainer wide>
      <PageHeader
        title="Members"
        back={{ href: "/admin", label: "Admin" }}
        description={`${rows.filter((r) => r.status === "active").length} active members. Only people on this list can sign in.`}
      />
      <MembersAdmin
        members={members}
        meId={me.id}
        canApproveDevices={canApproveDevices}
        initialFilter={typeof filter === "string" && isFilter(filter) ? filter : undefined}
      />
    </PageContainer>
  );
}
