/**
 * Fills the database with just enough to see every card on the home page:
 * celebrations this month, a phone waiting for approval, a medical leave
 * request, and a couple of upcoming calendar items. Safe to run twice.
 *
 *   npx tsx --env-file=.env.local scripts/dummy-home.ts
 */
import { and, asc, eq, gte, ne } from "drizzle-orm";
import { db, pool } from "@/db";
import { calendarEvent, device, leaveRequest, meeting, member, memberProfile } from "@/db/schema";
import { istToDate, toIstDateInput } from "@/lib/time";

/** A date in the given month, keeping the year in the past (a birth year). */
const on = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

async function main() {
  const today = toIstDateInput(new Date());
  const [y, m, d] = today.split("-").map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;

  const members = await db
    .select({ id: member.id, name: member.fullName })
    .from(member)
    .where(and(eq(member.status, "active"), eq(member.isChapterMember, true)))
    .orderBy(asc(member.fullName))
    .limit(6);
  if (members.length < 4) throw new Error("Needs at least 4 active chapter members.");

  // 1. Celebrations: one today, one later this month, one next month.
  const birthdays = [
    { member: members[0], date: on(1988, m, d) },
    { member: members[1], date: on(1991, m, Math.min(d + 9, 28)) },
    { member: members[2], date: on(1985, nextMonth, 12) },
  ];
  for (const b of birthdays) {
    await db
      .insert(memberProfile)
      .values({ memberId: b.member.id, dateOfBirth: b.date })
      .onConflictDoUpdate({ target: memberProfile.memberId, set: { dateOfBirth: b.date } });
  }
  const anniversary = on(2016, m, Math.min(d + 3, 28));
  await db
    .insert(memberProfile)
    .values({ memberId: members[3].id, anniversaryDate: anniversary })
    .onConflictDoUpdate({ target: memberProfile.memberId, set: { anniversaryDate: anniversary } });
  console.log(`Celebrations: ${birthdays.map((b) => b.member.name).join(", ")} + ${members[3].name} (anniversary)`);

  // 2. A phone waiting for approval → the members desk's "waiting" filter.
  const waiting = members[4] ?? members[0];
  await db.delete(device).where(and(eq(device.memberId, waiting.id), eq(device.status, "pending")));
  await db.insert(device).values({
    memberId: waiting.id,
    keyThumbprint: `dummy-${crypto.randomUUID()}`,
    publicKeyJwk: { kty: "EC", crv: "P-256", x: "dummy", y: "dummy" },
    label: "Android phone · Chrome",
    approvalCode: String(Math.floor(1000 + Math.random() * 9000)),
    status: "pending",
  });
  console.log(`Device waiting: ${waiting.name}`);

  // 3. A medical leave request on the next meeting → "1 medical leave request".
  const [next] = await db
    .select()
    .from(meeting)
    .where(and(eq(meeting.status, "scheduled"), gte(meeting.endsAt, new Date())))
    .orderBy(asc(meeting.startsAt))
    .limit(1);
  if (next) {
    const asker = members[5] ?? members[1];
    await db
      .insert(leaveRequest)
      .values({ meetingId: next.id, memberId: asker.id, kind: "medical", reason: "Fever, on the doctor's advice", status: "pending" })
      .onConflictDoUpdate({
        target: [leaveRequest.meetingId, leaveRequest.memberId],
        set: { kind: "medical", status: "pending", decidedAt: null, decidedById: null },
      });
    console.log(`Medical leave pending: ${asker.name} for ${next.title}`);
  } else {
    console.log("No upcoming meeting — skipped the leave request. Create one to see it.");
  }

  // 4. Two more things coming up on the calendar.
  const events = [
    { kind: "training", title: "Member Success Programme", date: on(y, m, Math.min(d + 5, 28)), location: "Chapter office" },
    { kind: "event", title: "Visitors Day", date: on(y, m, Math.min(d + 12, 28)), location: "Mariott" },
  ];
  for (const e of events) {
    const already = await db.select({ id: calendarEvent.id }).from(calendarEvent).where(eq(calendarEvent.title, e.title));
    if (already.length) continue;
    await db.insert(calendarEvent).values({
      kind: e.kind,
      title: e.title,
      startsAt: istToDate(e.date, "00:00"),
      endsAt: istToDate(e.date, "23:59"),
      location: e.location,
    });
  }
  console.log(`Coming up: ${events.map((e) => e.title).join(", ")}`);

  const [{ chapterMember }] = await db
    .select({ chapterMember: member.fullName })
    .from(member)
    .where(and(eq(member.status, "active"), eq(member.isChapterMember, true), ne(member.isAdmin, true)))
    .orderBy(asc(member.fullName))
    .limit(1);
  console.log(`\nSign in as a chapter member (e.g. ${chapterMember}) to see Next meeting and the device card.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
