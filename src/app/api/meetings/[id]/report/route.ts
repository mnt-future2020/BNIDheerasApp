import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getBoardData } from "@/lib/attendance/board";
import { getMeetingWithVenue } from "@/lib/attendance/queries";
import { buildMeetingReport, CHAPTER_NAME, type MeetingReport } from "@/lib/attendance/report";
import { getCurrentMember } from "@/lib/session";

const PAGE = { w: 595.28, h: 841.89 }; // A4
const MARGIN = 56;
const INK = rgb(0.07, 0.07, 0.07);
const GREY = rgb(0.42, 0.42, 0.42);

export const dynamic = "force-dynamic";

/** The attendance report as a PDF — the same figures as the WhatsApp message, without the emoji. */
export async function GET(_req: Request, ctx: RouteContext<"/api/meetings/[id]/report">) {
  const me = await getCurrentMember();
  if (!me || !(me.caps.has("palms.view") || me.caps.has("meeting.finalize"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const m = await getMeetingWithVenue(id);
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const report = buildMeetingReport(m, await getBoardData(m));
  const pdf = await renderReportPdf(report);

  return new NextResponse(pdf as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="palms-${m.startsAt.toISOString().slice(0, 10)}.pdf"`,
      "cache-control": "no-store",
    },
  });
}

async function renderReportPdf(r: MeetingReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const body = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - MARGIN;

  const line = (text: string, { size = 11, font = body, color = INK, gap = 6 } = {}) => {
    // A long absent list runs onto a second page rather than off the first.
    if (y < MARGIN + size) {
      page = doc.addPage([PAGE.w, PAGE.h]);
      y = PAGE.h - MARGIN;
    }
    y -= size;
    page.drawText(text, { x: MARGIN, y, size, font, color });
    y -= gap;
  };
  const rule = () => {
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE.w - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 10;
  };
  const section = (title: string, count: number, names: string[]) => {
    line(`${title}: ${count}`, { size: 12, font: bold, gap: 8 });
    if (names.length === 0) line("None", { color: GREY });
    else names.forEach((name, i) => line(`${i + 1}. ${name}`));
    y -= 6;
  };

  line(CHAPTER_NAME, { size: 20, font: bold, gap: 10 });
  line(`Meeting Date: ${r.date}`, { color: GREY });
  line(`Place: ${r.place}`, { color: GREY, gap: 10 });
  rule();

  line("Attendance Report", { size: 14, font: bold, gap: 10 });
  const { totals } = r;
  for (const [label, n] of [
    ["Members", totals.members],
    ["Present", totals.present],
    ["Absent", totals.absent],
    ["Substitute", totals.substitute],
    ["Medical", totals.medical],
    ["Late", totals.late],
  ] as const) {
    line(`${label}: ${n}`);
  }
  y -= 4;
  rule();

  section("Absent", totals.absent, r.absent);
  section("Substitute", totals.substitute, r.substitute);
  section("Late", totals.late, r.late);
  section("Medical", totals.medical, []);
  rule();
  line("Thank you", { color: GREY });

  return doc.save();
}
