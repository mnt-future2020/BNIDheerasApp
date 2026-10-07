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
import { MonthFilter } from "./month-filter";

export const metadata: Metadata = { title: "Events" };

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
      <PageHeader
        title="Events"
        description="Meetings, events, trainings and presentation slots."
        actions={
          <Button asChild variant={onlyMine ? "default" : "outline"} size="sm">
            <Link href={href({ mine: !onlyMine })}>My slots</Link>
          </Button>
        }
      />

      <div className="mb-3 space-y-2">
        <MonthFilter
          month={month}
          months={months.map((key) => ({
            key,
            label: formatMonth(istToDate(`${key}-01`)),
            href: href({ m: key }),
          }))}
        />
        {kinds.length > 1 ? (
          <div className="flex flex-wrap gap-1">
            <Button asChild size="sm" variant={kindFilter === null ? "default" : "outline"}>
              <Link href={href({ kind: null })}>All</Link>
            </Button>
            {kinds.map((k) => (
              <Button key={k} asChild size="sm" variant={kindFilter === k ? "default" : "outline"}>
                <Link href={href({ kind: k })}>{kindLabel(k)}</Link>
              </Button>
            ))}
          </div>
        ) : null}
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
