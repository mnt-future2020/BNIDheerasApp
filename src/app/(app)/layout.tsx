import Link from "next/link";
import { BottomNav, DesktopNav } from "@/components/app-nav";
import { AppCredit } from "@/components/app-credit";
import { BrandLogo } from "@/components/brand-logo";
import { TenureSwitcher } from "@/components/tenure-switcher";
import { UserMenu } from "@/components/user-menu";
import { requireMember } from "@/lib/session";
import { accountName } from "@/lib/settings";
import { publicUrl } from "@/lib/storage";
import { listTenures, selectedTenure } from "@/lib/tenure";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const me = await requireMember();
  const [tenures, tenure, name] = await Promise.all([listTenures(), selectedTenure(), accountName(me)]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          {/* Smaller on a phone: at the full 44px the lockup is 184px wide and,
              with the tenure name and the avatar beside it, the row no longer
              fits a 360px screen. */}
          <Link href="/" className="shrink-0">
            <BrandLogo height={44} preload className="h-8 w-auto sm:h-9 lg:h-11" />
          </Link>
          <div className="ml-2 flex-1">
            <DesktopNav caps={[...me.caps]} isChapterMember={me.isChapterMember} />
          </div>
          <TenureSwitcher tenures={tenures} selected={tenure?.id ?? ""} />
          {/* The app-admin account isn't a person, so it wears the chapter's
              badge and the Chapter Admin's name from Settings. */}
          <UserMenu
            name={name}
            email={me.email}
            loginId={me.phone ?? me.email}
            photoUrl={publicUrl(me.photoKey) ?? (me.isChapterMember ? null : "/images/bni-avatar.webp")}
            isChapterMember={me.isChapterMember}
          />
        </div>
      </header>
      <main className="pb-safe-nav flex-1 lg:pb-6">{children}</main>
      {/* On a wide screen there is no bottom bar to sit under, so the credit
          closes the page instead. On phones it rides with the bar. */}
      <AppCredit className="hidden pb-6 lg:block" />
      <BottomNav caps={[...me.caps]} isChapterMember={me.isChapterMember} />
    </div>
  );
}
