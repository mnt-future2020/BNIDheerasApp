import { ClockIcon, MapPinIcon, UserIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calendarItems, kindLabel } from "@/lib/calendar";
import { requireMember } from "@/lib/session";
import { selectedTenure } from "@/lib/tenure";
import { formatDate, formatMonth, formatTime, istToDate, toIstDateInput } from "@/lib/time";
import { cn } from "@/lib/utils";
import { LinkSelect } from "./filters";

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

/** Every month from one yyyy-mm to another, inclusive. */
function monthsBetween(from: string, to: string) {
  const list: string[] = [];
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  for (let i = 0; fy * 12 + fm + i <= ty * 12 + tm; i++) {
    const d = new Date(Date.UTC(fy, fm - 1 + i, 1));
    list.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return list;
}

export default async function EventsPage({ searchParams }: PageProps<"/calendar">) {
  const me = await requireMember();
  const { m, mine, kind } = await searchParams;
  const today = toIstDateInput(new Date());
  // The months to offer: the tenure being looked at, else a year around today.
  const tenure = await selectedTenure();
  const months = tenure
    ? monthsBetween(tenure.startsOn.slice(0, 7), tenure.endsOn.slice(0, 7))
    : monthsBetween(today.slice(0, 7), today.slice(0, 7));
  const fallback = months.includes(today.slice(0, 7)) ? today.slice(0, 7) : (months[0] ?? today.slice(0, 7));
  const month = typeof m === "string" && months.includes(m) ? m : fallback;
  const [y, mo] = month.split("-").map(Number);
  const monthStart = istToDate(`${month}-01`);
  const nextMonth = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  const monthEnd = istToDate(`${nextMonth}-01`);

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
        <LinkSelect
          label="Month"
          value={month}
          className="min-w-40 flex-1 sm:max-w-52"
          options={months.map((key) => ({
            key,
            label: formatMonth(istToDate(`${key}-01`)),
            href: href({ m: key }),
          }))}
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
