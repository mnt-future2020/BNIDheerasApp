import {
  CalendarCogIcon,
  HistoryIcon,
  MessageSquareTextIcon,
  SlidersHorizontalIcon,
  TrophyIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import type { Capability } from "@/lib/permissions";
import { requireMember } from "@/lib/session";

export const metadata: Metadata = { title: "Admin" };

const LINKS: { href: string; title: string; text: string; icon: React.ElementType; caps: Capability[] }[] = [
  // No "Device approvals" or "Venues" tile: a phone is approved from the
  // member's Action list on Members ("Phone waiting" gathers them), and a venue
  // is added from the Venue field while scheduling the meeting that needs it.
  { href: "/admin/meetings", title: "Meetings", text: "Schedule weekly meetings and times", icon: CalendarCogIcon, caps: ["meetings.manage"] },
  // No tile for Attendance & PALMS, Medical leave or the LVH desk: a meeting's
  // PALMS, summary, follow-ups, leave decisions and venue QR all hang off the
  // meeting itself, under Meetings.
  { href: "/admin/members", title: "Members", text: "Roster, add members, import CSV", icon: UsersIcon, caps: ["members.manage"] },
  { href: "/admin/roles", title: "Roles & terms", text: "Who holds which role this term", icon: UserCogIcon, caps: ["roles.manage"] },
  { href: "/admin/awards", title: "Weekly recognitions", text: "Pick this week's winners", icon: TrophyIcon, caps: ["awards.manage"] },
  { href: "/admin/calendar", title: "Events", text: "Events, trainings, presentation slots", icon: CalendarCogIcon, caps: ["calendar.manage"] },
  { href: "/admin/feedback", title: "Suggestions & feedback", text: "Consider what members raise, or not", icon: MessageSquareTextIcon, caps: ["feedback.manage"] },
  { href: "/admin/settings", title: "Settings", text: "The members' default sign-in password", icon: SlidersHorizontalIcon, caps: ["settings.manage"] },
  { href: "/admin/audit", title: "Audit log", text: "Who changed what, and why", icon: HistoryIcon, caps: ["audit.view"] },
];

export default async function AdminPage() {
  const me = await requireMember();
  const links = LINKS.filter((l) => l.caps.some((c) => me.caps.has(c)));
  return (
    <PageContainer wide>
      <PageHeader title="Admin" description="Tools for the chapter leadership team." />
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">You don&apos;t have admin roles this term.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map(({ href, title, text, icon: Icon }) => (
            <Link key={href} href={href}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="flex items-start gap-3 py-4">
                  <Icon className="mt-0.5 size-5 text-primary" />
                  <div>
                    <div className="font-semibold">{title}</div>
                    <div className="text-sm text-muted-foreground">{text}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
