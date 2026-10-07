import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { member, roleAssignment } from "@/db/schema";
import {
  CAPABILITIES,
  capabilitiesFor,
  hasFullAccess,
  permissionGrid,
  ROLE_KEYS,
  ROLES,
  roleConflict,
} from "@/lib/permissions";
import { requireCapPage } from "@/lib/session";
import { selectedTenure } from "@/lib/tenure";
import { RolesAdmin } from "./roles-admin";

export const metadata: Metadata = { title: "Roles & terms" };

export default async function RolesPage() {
  await requireCapPage("roles.manage");
  // Who held which role in the tenure picked at the top of the page. Looking at
  // an old tenure only shows it — nobody's permissions change with the view.
  const selected = await selectedTenure();
  const members = await db
    .select({ id: member.id, fullName: member.fullName, isAdmin: member.isAdmin, isChapterMember: member.isChapterMember, status: member.status })
    .from(member)
    .orderBy(asc(member.fullName));
  const assignments = selected
    ? await db
        .select({ id: roleAssignment.id, role: roleAssignment.role, memberId: roleAssignment.memberId })
        .from(roleAssignment)
        .where(eq(roleAssignment.termId, selected.id))
    : [];

  return (
    <PageContainer wide>
      <PageHeader
        title="Roles & terms"
        back={{ href: "/admin", label: "Admin" }}
        description={
          selected
            ? `Who holds which role in ${selected.name}. Permissions follow the role automatically.`
            : "Create a tenure in Settings first."
        }
      />
      <RolesAdmin
        selectedTermId={selected?.id ?? null}
        members={members.filter((m) => m.status === "active")}
        assignments={assignments}
        roles={ROLE_KEYS.map((key) => ({
          key,
          label: ROLES[key],
          fullAccess: hasFullAccess([key], false),
          // For the eye icon: what the role can do, and which roles it can't be held with.
          can: permissionGrid(capabilitiesFor([key], false)),
          notWith: ROLE_KEYS.filter((other) => other !== key && roleConflict([key, other])).map((k) => ROLES[k]),
        }))}
        everything={permissionGrid(new Set(CAPABILITIES))}
      />
    </PageContainer>
  );
}
