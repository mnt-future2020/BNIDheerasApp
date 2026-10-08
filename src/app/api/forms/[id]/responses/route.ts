import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { form, formResponse, member } from "@/db/schema";
import { toCsv } from "@/lib/csv";
import { answerText, slugify } from "@/lib/forms";
import { getCurrentMember } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * Every answer as a spreadsheet: one row per response, one column per question,
 * in the form's own order. The same columns as the table on screen, so what is
 * downloaded is what was read.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/forms/[id]/responses">) {
  const me = await getCurrentMember();
  if (!me?.caps.has("forms.manage")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const [f] = await db.select().from(form).where(eq(form.id, id));
  if (!f) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const rows = await db
    .select({
      at: formResponse.createdAt,
      data: formResponse.data,
      typedName: formResponse.respondentName,
      memberName: member.fullName,
    })
    .from(formResponse)
    .leftJoin(member, eq(member.id, formResponse.memberId))
    .where(eq(formResponse.formId, f.id))
    .orderBy(desc(formResponse.createdAt));

  const csv = toCsv([
    ["When", "Who", "Signed in", ...f.fields.map((q) => q.label)],
    ...rows.map((r) => [
      formatDateTime(r.at),
      r.memberName ?? r.typedName ?? "",
      r.memberName ? "Yes" : "No",
      ...f.fields.map((q) => answerText(r.data[q.id])),
    ]),
  ]);

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${slugify(f.title)}-answers.csv"`,
      "cache-control": "no-store",
    },
  });
}
