import { CAPABILITIES, type Capability } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  /** Used where the bar is tight — the phone's bottom tabs. Falls back to `label`. */
  shortLabel?: string;
  icon: string;
  cap?: Capability;
  anyCap?: Capability[];
  /** Part of taking part in the chapter: hidden from admin-only logins. */
  chapterOnly?: boolean;
};

/**
 * Every capability leads somewhere under Admin, so holding any one of them is
 * what opens the link. Listed by hand this went stale twice — a role given a
 * new capability could reach its page but had no way in from the navigation.
 */
const ADMIN_CAPS: Capability[] = [...CAPABILITIES];

/**
 * The phone's bottom bar: five tabs at most, so each one stays wide enough to
 * hit. Everything else lives behind More, which opens a drawer rather than a
 * page of its own.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/scan", label: "Check in", icon: "scan", chapterOnly: true },
  // The page is a list of what's on, not a month grid: it reads as Events.
  { href: "/calendar", label: "Events", icon: "calendar" },
  { href: "/members", label: "Members", icon: "users" },
  // Not chapter-only any more: Admin sits behind it, and an admin-only login
  // needs a way in. Its password and sign-out are in the account menu too.
  { href: "/more", label: "More", icon: "menu" },
];

/** Behind More on phones, and spread across the header on a wide screen. */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/near", label: "Near me", icon: "map", chapterOnly: true },
  { href: "/awards", label: "Recognitions", icon: "trophy" },
  // Your own card. Someone else's is opened from their member page.
  { href: "/dance-card", label: "1-to-1 dance card", icon: "card", chapterOnly: true },
  { href: "/feedback", label: "Feedback", icon: "feedback", chapterOnly: true },
  // What the chapter is asking right now. The public link is still how a form
  // travels; this is so a member doesn't have to go looking for it.
  { href: "/forms", label: "Forms", icon: "form" },
  // An admin-only login is not a person: it has no profile, only a password.
  { href: "/me", label: "My profile", icon: "user", chapterOnly: true },
  // No LVH desk of its own: the QR, pairing and PALMS all hang off the meeting.
  { href: "/admin", label: "Admin", icon: "settings", anyCap: ADMIN_CAPS },
];

export function visible(item: NavItem, caps: ReadonlySet<string>, isChapterMember = true): boolean {
  if (item.chapterOnly && !isChapterMember) return false;
  if (item.cap && !caps.has(item.cap)) return false;
  if (item.anyCap && !item.anyCap.some((c) => caps.has(c))) return false;
  return true;
}

/** The bottom bar holds this many before anything has to go behind More. */
export const BOTTOM_NAV_MAX = 5;

/**
 * What the phone's bottom bar shows. An admin-only login can reach everything
 * it has in five tabs, so More would be a drawer with nothing left to put in
 * it: when the whole list fits, it is shown and More drops out.
 */
export function bottomNav(
  caps: ReadonlySet<string>,
  isChapterMember: boolean,
): { tabs: NavItem[]; rest: NavItem[] } {
  const primary = PRIMARY_NAV.filter((i) => i.href !== "/more" && visible(i, caps, isChapterMember));
  const rest = SECONDARY_NAV.filter((i) => visible(i, caps, isChapterMember));
  if (primary.length + rest.length <= BOTTOM_NAV_MAX) return { tabs: [...primary, ...rest], rest: [] };
  const more = PRIMARY_NAV.find((i) => i.href === "/more")!;
  return { tabs: [...primary, more], rest };
}
