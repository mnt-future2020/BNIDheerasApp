import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { memberProfile } from "@/db/schema";
import { ROLES } from "@/lib/permissions";
import { requireMember } from "@/lib/session";
import { accountName } from "@/lib/settings";
import { publicUrl } from "@/lib/storage";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "My profile" };

/* Only the business profile lives here now. The password is in the account
   menu behind the avatar, the check-in phone is on Home, and the dance card is
   in More — each next to the thing it belongs to. */

export default async function MePage() {
  const me = await requireMember();
  // An admin-only login isn't a person: no photo, business or dance card.
  if (!me.isChapterMember) {
    return (
      <PageContainer>
        <PageHeader title="Account" description={`${await accountName(me)} · ${me.email}`} />
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            This is an admin account, not a chapter member, so it has no profile. Your login ID is{" "}
            {me.phone ? `your mobile number (${me.phone})` : `your email (${me.email})`}, and the password is under the
            avatar at the top of the page.
          </CardContent>
        </Card>
      </PageContainer>
    );
  }
  const [profile] = await db.select().from(memberProfile).where(eq(memberProfile.memberId, me.id));

  return (
    <PageContainer>
      <PageHeader title="My profile" description={`${me.fullName} · ${me.email}`} />
      {me.roles.length ? (
        <div className="-mt-3 mb-4 flex flex-wrap gap-1.5">
          {me.roles.map((r) => (
            <Badge key={r} variant="secondary">
              {ROLES[r]}
            </Badge>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            photoUrl={publicUrl(me.photoKey)}
            logoUrl={publicUrl(profile?.logoKey)}
            category={me.category}
            initial={{
              businessName: me.businessName ?? "",
              about: profile?.about ?? "",
              website: profile?.website ?? "",
              whatsapp: profile?.whatsapp ?? me.phone ?? "",
              videoUrl: profile?.videoUrl ?? "",
              instagram: profile?.socials.instagram ?? "",
              facebook: profile?.socials.facebook ?? "",
              linkedin: profile?.socials.linkedin ?? "",
              youtube: profile?.socials.youtube ?? "",
              x: profile?.socials.x ?? "",
              dateOfBirth: profile?.dateOfBirth ?? "",
              anniversaryDate: profile?.anniversaryDate ?? "",
            }}
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
