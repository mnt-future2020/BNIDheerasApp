import { ClockIcon, MapPinIcon, UserIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkSelect } from "@/components/link-select";
import { MonthFilter } from "@/components/month-filter";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calendarItems, kindLabel } from "@/lib/calendar";
import { monthOf, monthOptions, monthWindow, tenureMonthKeys } from "@/lib/months";
import { requireMember } from "@/lib/session";
import { selectedTenure } from "@/lib/tenure";
import { formatDate, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";


export const metadata: Metadata = { title: "Events" };

/**
 * Radix Select has no empty value, so "no kind filter" needs a name. A chapter
 * types its own kinds, so this one is spelled to never be one of them.
 */
const ALL_KINDS = "__all";

const CUSTOM_COLOR = "bg-neutral-500 text-white";

const KIND_COLORS: Record<string, string> = {
  meeting: "bg-primary text-primary-foreground",
  event: "bg-sky-600 text-white",
  training: "bg-emerald-600 text-white",
  feature_presentation: "bg-violet-600 text-white",
  education_slot: "bg-amber-600 text-white",
};

export default async function EventsPage({ searchParams }: PageProps<"/calendar">) {
  const me = await requireMember();
  const { m, mine, kind } = await searchParams;
  const thisMonth = monthOf(new Date());
  // The months to offer: the tenure being looked at, else this month alone.
  const tenure = await selectedTenure();
  const months = tenure ? tenureMonthKeys(tenure) : [thisMonth];
  const fallback = months.includes(thisMonth) ? thisMonth : (months[0] ?? thisMonth);
  const month = typeof m === "string" && months.includes(m) ? m : fallback;
  const { from: monthStart, to: monthEnd } = monthWindow(month);

  const onlyMine = mine === "1";
  const kindFilter = typeof kind === "string" && kind ? kind : null;
  const all = await calendarItems(monthStart, monthEnd);
  const items = all
    .filter((i) => !onlyMine || i.presenter?.id === me.id)
    .filter((i) => !kindFilter || i.kind === kindFilter);

  // Every filter keeps the others, so they can be combined.
  const href = (next: { m?: string; kind?: string | null; mine?: boolean }) => {
    const qs = new URLSearchParams();
    const chosenMonth = next.m ?? month;
    if (chosenMonth !== fallback) qs.set("m", chosenMonth);
    const chosenKind = next.kind === undefined ? kindFilter : next.kind;
    if (chosenKind) qs.set("kind", chosenKind);
    if (next.mine ?? onlyMine) qs.set("mine", "1");
    const s = qs.toString();
    return s ? `/calendar?${s}` : "/calendar";
  };
  // Only the kinds actually in this month, so no filter leads to an empty list.
  const kinds = [...new Set(all.map((i) => i.kind))];

  return (
    <PageContainer>
      <PageHeader title="Events" description="Meetings, events, trainings and presentation slots." />

      {/* All three narrow the same list, so they sit on one row together rather
          than "My slots" living apart up in the page actions. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <MonthFilter
          value={month}
          months={monthOptions(months)}
          path="/calendar"
          params={{ kind: kindFilter || undefined, mine: onlyMine ? "1" : undefined }}
        />
        {kinds.length > 1 ? (
          <LinkSelect
            label="Type"
            value={kindFilter ?? ALL_KINDS}
            className="min-w-40 flex-1 sm:max-w-52"
            options={[
              { key: ALL_KINDS, label: "All types", href: href({ kind: null }) },
              ...kinds.map((k) => ({ key: k, label: kindLabel(k), href: href({ kind: k }) })),
            ]}
          />
        ) : null}
        <Button asChild variant={onlyMine ? "default" : "outline"} className="shrink-0">
          <Link href={href({ mine: !onlyMine })}>
            <UserIcon /> My slots
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing scheduled this month{onlyMine ? " for you" : ""}.</p>
      ) : (
        <div className="divide-y rounded-xl border">
          {items.map((it) => (
            <div key={it.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="w-36 shrink-0 text-sm font-medium">{formatDate(it.startsAt)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("font-semibold", it.cancelled && "line-through")}>{it.title}</span>
                  <Badge className={KIND_COLORS[it.kind] ?? CUSTOM_COLOR}>{kindLabel(it.kind)}</Badge>
                  {it.cancelled ? <Badge variant="destructive">Cancelled</Badge> : null}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {/* Meetings have real times; calendar items are whole-day. */}
                  {it.source === "meeting" ? (
                    <span className="flex items-center gap-1">
                      <ClockIcon className="size-3.5" /> {formatTime(it.startsAt)} – {formatTime(it.endsAt)}
                    </span>
                  ) : null}
                  {it.location ? (
                    <span className="flex items-center gap-1">
                      <MapPinIcon className="size-3.5" /> {it.location}
                    </span>
                  ) : null}
                  {it.presenter ? (
                    <Link href={`/members/${it.presenter.id}`} className="flex items-center gap-1 text-primary">
                      <UserIcon className="size-3.5" /> {it.presenter.name}
                    </Link>
                  ) : null}
                </div>
                {it.description ? <p className="mt-1 text-sm whitespace-pre-line">{it.description}</p> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
