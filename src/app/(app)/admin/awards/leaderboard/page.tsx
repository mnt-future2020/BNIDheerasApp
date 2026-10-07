import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { getLeaderboard } from "@/lib/awards";
import { requireCapPage } from "@/lib/session";

export const metadata: Metadata = { title: "Recognitions leaderboard" };

export default async function AwardsLeaderboardPage() {
  await requireCapPage("awards.manage");
  const board = await getLeaderboard();
  return (
    <PageContainer wide>
      <PageHeader
        title="Leaderboard"
        back={{ href: "/admin/awards", label: "Recognitions" }}
        description={
          board.termName
            ? `Published recognitions this term (${board.termName}).`
            : "Every published recognition. Start a term to count by term."
        }
      />
      <LeaderboardTable board={board} />
    </PageContainer>
  );
}
