"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/nav-icon";
import { type NavItem, PRIMARY_NAV, SECONDARY_NAV, visible } from "@/components/nav-items";
// Loaded on every page so the browser's install offer is caught wherever it fires (Home shows the button).
import "@/lib/install-app";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav({ caps, isChapterMember }: { caps: string[]; isChapterMember: boolean }) {
  const pathname = usePathname();
  const items = PRIMARY_NAV.filter((i) => visible(i, new Set(caps), isChapterMember));
  return (
    <nav className="bottom-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden">
      {/* The column count follows the list: an admin-only login has fewer tabs. */}
      <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 px-0.5",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <NavIcon name={item.icon} className={cn("size-5 shrink-0", item.icon === "scan" && "size-6")} />
                {/* Eight tabs fit a 375px phone only at this size, so the label never wraps. */}
                <span className="w-full truncate text-center text-[10px] font-medium leading-none">
                  {item.shortLabel ?? item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DesktopNav({ caps, isChapterMember }: { caps: string[]; isChapterMember: boolean }) {
  const pathname = usePathname();
  const set = new Set(caps);
  const items: NavItem[] = [
    // Admin trails the chapter links in the header, so it is pulled out and re-appended.
    ...PRIMARY_NAV.filter((i) => i.href !== "/more" && i.href !== "/admin"),
    ...SECONDARY_NAV.filter((i) => i.href === "/feedback"),
    ...PRIMARY_NAV.filter((i) => i.href === "/admin"),
  ].filter((i) => visible(i, set, isChapterMember));
  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-sm font-medium",
            isActive(pathname, item.href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
