import "server-only";
import type { BoardData } from "@/lib/attendance/board";
import type { MeetingWithVenue } from "@/lib/attendance/queries";
import { longDate, type MeetingReport } from "@/lib/attendance/report-text";

export { CHAPTER_NAME, type MeetingReport, reportText } from "@/lib/attendance/report-text";

/** The figures and the three name lists behind the post-meeting message. */
export function buildMeetingReport(m: MeetingWithVenue, data: BoardData): MeetingReport {
  const of = (status: string) => data.members.filter((r) => r.status === status);
  const names = (status: string) => of(status).map((r) => r.name);

  return {
    date: longDate(m.startsAt),
    place: (m.mode === "online" ? "Online" : (m.venue?.name ?? "—")).toUpperCase(),
    totals: {
      members: data.members.length,
      present: of("P").length,
      absent: of("A").length,
      substitute: of("S").length,
      medical: of("M").length,
      late: of("L").length,
    },
    absent: names("A"),
    substitute: names("S"),
    late: names("L"),
  };
}
