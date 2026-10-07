import type { Capability } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  cap?: Capability;
  anyCap?: Capability[];
  /** Part of taking part in the chapter: hidden from admin-only logins. */
  chapterOnly?: boolean;
};

/** Bottom navigation on phones. */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/scan", label: "Check in", icon: "scan", chapterOnly: true },
  { href: "/near", label: "Near me", icon: "map", chapterOnly: true },
  // The page is a list of what's on, not a month grid: it reads as Events.
  { href: "/calendar", label: "Events", icon: "calendar" },
  { href: "/more", label: "More", icon: "menu" },
];

/** Everything else, shown on the More page and in the desktop header. */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/members", label: "Members", icon: "users" },
  { href: "/awards", label: "Recognitions", icon: "trophy" },
  // No dance card here: it's opened from My profile, and from a member's page.
  { href: "/feedback", label: "Feedback", icon: "feedback", chapterOnly: true },
  // An admin-only login is not a person: it has no profile, only a password.
  { href: "/me", label: "My profile", icon: "user", chapterOnly: true },
];

export const STAFF_NAV: NavItem[] = [
  // No LVH desk of its own: the QR, pairing and PALMS all hang off the meeting.
  { href: "/admin", label: "Admin", icon: "settings", anyCap: [
    "members.manage",
    "roles.manage",
    "devices.approve",
    "leave.approve",
    "meetings.manage",
    "kiosk.run",
    "attendance.manual",
    "awards.manage",
    "calendar.manage",
    "feedback.manage",
    "settings.manage",
    "audit.view",
    "palms.view",
  ] },
];

export function visible(item: NavItem, caps: ReadonlySet<string>, isChapterMember = true): boolean {
  if (item.chapterOnly && !isChapterMember) return false;
  if (item.cap && !caps.has(item.cap)) return false;
  if (item.anyCap && !item.anyCap.some((c) => caps.has(c))) return false;
  return true;
}
