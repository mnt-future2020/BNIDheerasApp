import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { getDefaultPassword } from "@/lib/passwords";
import { requireCapPage } from "@/lib/session";
import { listTenures } from "@/lib/tenure";
import { toIstDateInput } from "@/lib/time";
import { DefaultPasswordForm } from "./default-password-form";
import { TenureForm } from "./tenure-form";

export const metadata: Metadata = { title: "Settings" };

/* Attendance rules aren't here: they're BNI policy (3 absences in 6 months,
   the lateness flag), so they stay fixed in lib/settings.ts. */

export default async function SettingsPage() {
  const me = await requireCapPage("settings.manage");
  const [defaultPassword, tenures] = await Promise.all([getDefaultPassword(), listTenures()]);
  return (
    <PageContainer>
      <PageHeader title="Settings" back={{ href: "/admin", label: "Admin" }} />
      {me.caps.has("roles.manage") ? (
        <>
          <h2 className="mb-1 font-semibold">Tenures</h2>
          <p className="mb-2 text-sm text-muted-foreground">
            A tenure runs in whole months. Meetings, PALMS, recognitions and events are shown for the tenure picked at
            the top of the page; the member list and everyone&apos;s permissions are not affected.
          </p>
          <TenureForm tenures={tenures} thisYear={Number(toIstDateInput(new Date()).slice(0, 4))} />
        </>
      ) : null}
      <h2 className="mt-6 mb-2 font-semibold">Member sign-in</h2>
      <DefaultPasswordForm initial={defaultPassword} />
    </PageContainer>
  );
}
