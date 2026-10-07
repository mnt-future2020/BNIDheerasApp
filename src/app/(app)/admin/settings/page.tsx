import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { getDefaultPassword } from "@/lib/passwords";
import { requireCapPage } from "@/lib/session";
import { getChapterAdmin } from "@/lib/settings";
import { currentTenure, listTenures } from "@/lib/tenure";
import { formatDate, toIstDateInput } from "@/lib/time";
import { ChapterAdminForm } from "./chapter-admin-form";
import { DefaultPasswordForm } from "./default-password-form";
import { TenureForm } from "./tenure-form";

export const metadata: Metadata = { title: "Settings" };

/* Attendance rules aren't here: they're BNI policy (3 absences in 6 months,
   the lateness flag), so they stay fixed in lib/settings.ts. */

export default async function SettingsPage() {
  const me = await requireCapPage("settings.manage");
  const now = new Date();
  const today = toIstDateInput(now);
  const [defaultPassword, tenures, current, chapterAdmin] = await Promise.all([
    getDefaultPassword(),
    listTenures(),
    currentTenure(now),
    getChapterAdmin(),
  ]);
  return (
    <PageContainer>
      <PageHeader title="Settings" back={{ href: "/admin", label: "Admin" }} />
      <h2 className="mb-2 font-semibold">Chapter</h2>
      <ChapterAdminForm initial={chapterAdmin} />
      {me.caps.has("roles.manage") ? (
        <>
          <h2 className="mt-6 mb-1 font-semibold">Tenures</h2>
          <p className="mb-2 text-sm text-muted-foreground">
            A tenure runs in whole months. Meetings, PALMS, recognitions and events are shown for the tenure picked at
            the top of the page; the member list and everyone&apos;s permissions are not affected.
          </p>
          {/* The server's own date, so "which tenure is current" can be checked. */}
          <p className="mb-2 text-sm">
            Today, as the app reads it: <b>{formatDate(now)}</b>{" "}
            <span className="text-muted-foreground">({today}, IST)</span>
            {current ? (
              <>
                {" "}
                — inside <b>{current.name}</b>, so that tenure&apos;s roles are the ones in force.
              </>
            ) : (
              <span className="text-amber-700">
                {" "}
                — no tenure covers today, so nobody holds a role right now except app admins. Create one that includes
                today.
              </span>
            )}
          </p>
          <TenureForm tenures={tenures} today={today} />
        </>
      ) : null}
      <h2 className="mt-6 mb-2 font-semibold">Member sign-in</h2>
      <DefaultPasswordForm initial={defaultPassword} />
    </PageContainer>
  );
}
