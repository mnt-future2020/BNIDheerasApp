import type { Metadata } from "next";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { PageContainer, PageHeader } from "@/components/page-header";
import { getLeaderboard } from "@/lib/awards";
import { requireMember } from "@/lib/session";

export const metadata: Metadata = { title: "Leaderboard" };

/** The same table the Head Table sees, for every member. */
export default async function LeaderboardPage() {
  await requireMember();
  const board = await getLeaderboard();
  return (
    <PageContainer wide>
      <PageHeader
        title="Leaderboard"
        back={{ href: "/awards", label: "Recognitions" }}
        description={board.termName ? `This term (${board.termName}).` : "Every recognition so far."}
      />
      <LeaderboardTable board={board} />
    </PageContainer>
  );
}
