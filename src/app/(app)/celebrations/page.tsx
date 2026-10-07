import { and, count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { CelebrationRow } from "@/components/celebration-row";
import { MonthFilter } from "@/components/month-filter";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { member } from "@/db/schema";
import { getCelebrations, isToday, MONTH_NAMES, today } from "@/lib/celebrations";
import { monthOptions, tenureMonthKeys } from "@/lib/months";
import { requireMember } from "@/lib/session";
import { selectedTenure } from "@/lib/tenure";

export const metadata: Metadata = { title: "Celebrations" };

/** Birthdays and anniversaries falling inside the tenure picked at the top of the page. */
export default async function CelebrationsPage({ searchParams }: PageProps<"/celebrations">) {
  await requireMember();
  const now = today();
  const [all, [{ members }], tenure, sp] = await Promise.all([
    getCelebrations(),
    db
      .select({ members: count() })
      .from(member)
      .where(and(eq(member.status, "active"), eq(member.isChapterMember, true))),
    selectedTenure(),
    searchParams,
  ]);
  const withBirthday = new Set(all.filter((c) => c.kind === "birthday").map((c) => c.memberId)).size;
  // The tenure's months, or the twelve from this one when no tenure covers it.
  // Birthdays repeat every year, so only the month of each key is used to match
  // — the year is there to say which month of the tenure is meant.
  const keys = tenure
    ? tenureMonthKeys(tenure)
    : Array.from({ length: 12 }, (_, i) => {
        const d = new Date(Date.UTC(now.year, now.month - 1 + i, 1));
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      });
  const thisMonth = keys.find((k) => Number(k.slice(5)) === now.month);
  const month = typeof sp.m === "string" && keys.includes(sp.m) ? sp.m : "";
  const shown = month ? [month] : keys;

  return (
    <PageContainer>
      <PageHeader
        title="Celebrations"
        back={{ href: "/", label: "Home" }}
        description={
          tenure
            ? `${tenure.name}. ${withBirthday} of ${members} members have added their birthday in My profile.`
            : `${withBirthday} of ${members} members have added their birthday in My profile.`
        }
      />
      <MonthFilter
        className="mb-4"
        value={month}
        months={monthOptions(keys)}
        allLabel="Every month"
        href={(key) => (key ? `/celebrations?m=${key}` : "/celebrations")}
      />
      <div className="space-y-4">
        {shown.map((key) => {
          const m = Number(key.slice(5));
          const list = all.filter((c) => c.month === m);
          return (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {MONTH_NAMES[m - 1]}
                  {key === thisMonth ? (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">this month</span>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No birthdays or anniversaries.</p>
                ) : (
                  <div className="space-y-0.5">
                    {list.map((c) => (
                      <CelebrationRow key={`${c.memberId}-${c.kind}`} c={c} today={isToday(c, now)} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {shown.length === 0 ? <EmptyState title="No months in this tenure." /> : null}
      </div>
    </PageContainer>
  );
}
