import "server-only";
import { and, asc, count, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { award, awardType, meeting, member } from "@/db/schema";
import { selectedTenure, tenureRange } from "@/lib/tenure";

export type LeaderboardRow = { memberId: string; name: string; photoKey: string | null; counts: Map<string, number>; total: number };
export type Leaderboard = {
  /** The award types, in the order they're shown as columns. */
  types: { id: string; name: string }[];
  rows: LeaderboardRow[];
  /** The tenure counted. */
  termName: string | null;
};

/**
 * Who has won what. Published recognitions only — a draft isn't anybody's yet —
 * and only the tenure being looked at, so the figures match the rest of the app.
 */
export async function getLeaderboard(): Promise<Leaderboard> {
  const tenure = await selectedTenure();
  const published = eq(award.published, true);
  const where = tenure
    ? and(published, gte(meeting.startsAt, tenureRange(tenure).from), lt(meeting.startsAt, tenureRange(tenure).to))
    : published;

  const [types, rows] = await Promise.all([
    db.select().from(awardType).where(eq(awardType.isActive, true)).orderBy(asc(awardType.sortOrder)),
    db
      .select({
        memberId: member.id,
        name: member.fullName,
        photoKey: member.photoKey,
        typeId: award.awardTypeId,
        wins: count(),
      })
      .from(award)
      .innerJoin(meeting, eq(meeting.id, award.meetingId))
      .innerJoin(member, eq(member.id, award.memberId))
      .where(where)
      .groupBy(member.id, member.fullName, member.photoKey, award.awardTypeId),
  ]);

  // One row per winner: their count under each award, and the total.
  const byMember = new Map<string, LeaderboardRow>();
  for (const r of rows) {
    const entry = byMember.get(r.memberId) ?? {
      memberId: r.memberId,
      name: r.name,
      photoKey: r.photoKey,
      counts: new Map<string, number>(),
      total: 0,
    };
    entry.counts.set(r.typeId, r.wins);
    entry.total += r.wins;
    byMember.set(r.memberId, entry);
  }

  return {
    types: types.map((t) => ({ id: t.id, name: t.name })),
    rows: [...byMember.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    termName: tenure?.name ?? null,
  };
}
