"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NavIcon } from "@/components/nav-icon";
import { bottomNav, type NavItem, PRIMARY_NAV, SECONDARY_NAV, visible } from "@/components/nav-items";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
// Loaded on every page so the browser's install offer is caught wherever it fires (Home shows the button).
import "@/lib/install-app";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const tab = (active: boolean) =>
  cn("flex h-16 w-full flex-col items-center justify-center gap-1 px-0.5", active ? "text-primary" : "text-muted-foreground");
const tabLabel = "w-full truncate text-center text-[10px] font-medium leading-none";

export function BottomNav({ caps, isChapterMember }: { caps: string[]; isChapterMember: boolean }) {
  const pathname = usePathname();
  const set = new Set(caps);
  const [open, setOpen] = useState(false);
  const { tabs: items, rest } = bottomNav(set, isChapterMember);

  return (
    <>
      <nav className="bottom-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden">
        {/* The column count follows the list: an admin-only login has fewer tabs. */}
        <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((item) => {
            // More is the way to everything else, so it opens the drawer in
            // place rather than taking the member off to a page of links.
            const isMore = item.href === "/more";
            const active = isMore ? open : isActive(pathname, item.href);
            return (
              <li key={item.href} className="min-w-0">
                {isMore ? (
                  <button type="button" className={tab(active)} aria-expanded={open} onClick={() => setOpen(true)}>
                    <NavIcon name={item.icon} className="size-5 shrink-0" />
                    <span className={tabLabel}>{item.shortLabel ?? item.label}</span>
                  </button>
                ) : (
                  <Link href={item.href} className={tab(active)}>
                    <NavIcon
                      name={item.icon}
                      className={cn("size-5 shrink-0", item.icon === "scan" && "size-6")}
                    />
                    <span className={tabLabel}>{item.shortLabel ?? item.label}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Partial, from the side: the page stays visible behind it, so More
          reads as a detour rather than somewhere you have to come back from. */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-3/4 gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b">
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <nav className="bottom-safe flex-1 overflow-y-auto">
            {rest.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                // A tap navigates, so the drawer shouldn't still be there on arrival.
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 border-b px-4 py-3.5",
                  isActive(pathname, item.href) && "bg-muted/50",
                )}
              >
                <NavIcon name={item.icon} className="size-5 shrink-0 text-primary" />
                <span className="flex-1 font-medium">{item.label}</span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function DesktopNav({ caps, isChapterMember }: { caps: string[]; isChapterMember: boolean }) {
  const pathname = usePathname();
  const set = new Set(caps);
  const items: NavItem[] = [
    // There is no More on a wide screen: everything fits in the header. My
    // profile is left out — it lives in the account menu, with sign-out.
    ...PRIMARY_NAV.filter((i) => i.href !== "/more"),
    ...SECONDARY_NAV.filter((i) => i.href !== "/me" && i.href !== "/admin"),
    // Admin trails the chapter's own links.
    ...SECONDARY_NAV.filter((i) => i.href === "/admin"),
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
