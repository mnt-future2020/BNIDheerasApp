import { TIME_ZONE } from "@/lib/time";

export const CHAPTER_NAME = "BNI DHEERAS";

export type MeetingReport = {
  date: string;
  place: string;
  totals: { members: number; present: number; absent: number; substitute: number; medical: number; late: number };
  /** Names only — the lists are read out, not totted up. */
  absent: string[];
  substitute: string[];
  late: string[];
};

/** "25th SEPTEMBER 2026", the way the chapter writes it in the group. */
export function longDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = Number(get("day"));
  // 11th–13th break the usual 1st/2nd/3rd pattern.
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][day % 10] ?? "th");
  return `${day}${suffix} ${get("month").toUpperCase()} ${get("year")}`;
}

const list = (names: string[]) => names.map((name, i) => `${i + 1}. ${name}`).join("\n");

/** The WhatsApp message the Secretary posts after the meeting. */
export function reportText(r: MeetingReport): string {
  const { totals } = r;
  return [
    `🅱️ ${CHAPTER_NAME}`,
    `📅 Meeting Date: ${r.date}`,
    `📍 Place: ${r.place}`,
    "",
    "⸻",
    "",
    "🅰️ Attendance Report",
    "",
    `\t•\t🔵 Members: ${totals.members}`,
    `\t•\t🟢 Present: ${totals.present}`,
    `\t•\t🔴 Absent: ${totals.absent}`,
    `\t•\t🟣 Substitute: ${totals.substitute}`,
    `\t•\t⚪️ Medical: ${totals.medical}`,
    `\t•\t🔵 Late: ${totals.late}`,
    "",
    "⸻",
    "",
    `🔹 Absent : ${totals.absent}`,
    "",
    list(r.absent),
    "",
    `🔹 Substitute : ${totals.substitute}`,
    "",
    list(r.substitute),
    "",
    `🪻 Late - ${totals.late}`,
    "",
    list(r.late),
    "",
    `Medical - ${totals.medical}`,
    "",
    "⸻",
    "Thank you",
  ]
    // An empty list would otherwise leave two blank lines in a row.
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");
}
