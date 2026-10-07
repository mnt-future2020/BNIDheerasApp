import { and, count, desc, eq, gte, like, lt, or } from "drizzle-orm";
import type { Metadata } from "next";
import { LinkSelect } from "@/components/link-select";
import { MonthFilter } from "@/components/month-filter";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { auditLog, member } from "@/db/schema";
import { auditLabel, auditSubject } from "@/lib/audit-labels";
import { monthOptions, monthWindow, tenureMonthKeys } from "@/lib/months";
import { pageFromParam, pageHref, paginate } from "@/lib/pagination";
import { requireCapPage } from "@/lib/session";
import { selectedTenure, tenureRange } from "@/lib/tenure";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;
/** Each area matches actions starting with any of its prefixes (e.g. "meeting."). */
const FILTERS: { key: string; label: string; prefixes: string[] }[] = [
  { key: "", label: "Everything", prefixes: [] },
  { key: "attendance", label: "Attendance", prefixes: ["attendance", "substitute", "absence", "kiosk"] },
  { key: "device", label: "Phones", prefixes: ["device"] },
  { key: "meeting", label: "Meetings", prefixes: ["meeting", "venue"] },
  { key: "member", label: "Members", prefixes: ["member"] },
  { key: "role", label: "Roles & tenures", prefixes: ["role", "term", "admin"] },
  { key: "leave", label: "Can't attend", prefixes: ["leave"] },
  { key: "awards", label: "Recognitions", prefixes: ["awards"] },
  { key: "calendar", label: "Events", prefixes: ["calendar"] },
  { key: "feedback", label: "Feedback", prefixes: ["feedback"] },
  { key: "settings", label: "Settings", prefixes: ["settings"] },
];

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireCapPage("audit.view");
  const sp = await searchParams;
  const filter = FILTERS.find((x) => x.key === sp.f) ?? FILTERS[0];
  // What was done during the tenure being looked at.
  const tenure = await selectedTenure();
  const range = tenure ? tenureRange(tenure) : null;
  const months = tenure ? tenureMonthKeys(tenure) : [];
  const month = typeof sp.m === "string" && months.includes(sp.m) ? sp.m : "";
  // A month narrows the tenure; without one, the whole tenure is listed.
  const picked = month ? monthWindow(month) : range;
  const where = and(
    filter.prefixes.length ? or(...filter.prefixes.map((p) => like(auditLog.action, `${p}.%`))) : undefined,
    picked ? gte(auditLog.at, picked.from) : undefined,
    picked ? lt(auditLog.at, picked.to) : undefined,
  );
  const [{ total }] = await db.select({ total: count() }).from(auditLog).where(where);
  const { page, pageCount, offset } = paginate(pageFromParam(sp.page), total, PAGE_SIZE);
  const rows = await db
    .select({ log: auditLog, actor: member.fullName })
    .from(auditLog)
    .leftJoin(member, eq(member.id, auditLog.actorId))
    .where(where)
    .orderBy(desc(auditLog.at))
    .limit(PAGE_SIZE)
    .offset(offset);

  return (
    <PageContainer>
      <PageHeader
        title="Audit log"
        back={{ href: "/admin", label: "Admin" }}
        description="Every manual attendance change, approval and setting change, with who did it and why."
      />
      {/* Two dropdowns rather than a wall of chips: when, and what kind. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <MonthFilter
          value={month}
          months={monthOptions(months)}
          allLabel="Whole tenure"
          path="/admin/audit"
          params={{ f: filter.key || undefined }}
        />
        <LinkSelect
          label="Area"
          value={filter.key}
          className="min-w-40 flex-1 sm:max-w-52"
          options={FILTERS.map((x) => ({
            key: x.key,
            label: x.label,
            // A narrowed list starts at page one.
            href: pageHref("/admin/audit", { f: x.key || undefined, m: month || undefined }, 1),
          }))}
        />
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                  Nothing recorded in this period.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map(({ log, actor }) => {
              // Who or what it was done to, and why — one quiet line under the
              // action, so "with who did it and why" still holds with three columns.
              const subject = auditSubject(log.after) ?? auditSubject(log.before);
              return (
                <TableRow key={log.id}>
                  <TableCell className="align-top text-sm whitespace-nowrap">{formatDateTime(log.at)}</TableCell>
                  <TableCell className="align-top text-sm">{actor ?? "System"}</TableCell>
                  <TableCell className="align-top text-sm">
                    <div>{auditLabel(log.action)}</div>
                    {subject || log.reason ? (
                      <div className="text-xs text-muted-foreground">
                        {[subject, log.reason].filter(Boolean).join(" · ")}
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={PAGE_SIZE}
        href={(p) => pageHref("/admin/audit", { f: filter.key || undefined, m: month || undefined }, p)}
      />
    </PageContainer>
  );
}
