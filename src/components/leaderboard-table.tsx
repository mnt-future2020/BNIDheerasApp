import { MemberAvatar } from "@/components/member-avatar";
import { EmptyState } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Leaderboard } from "@/lib/awards";
import { publicUrl } from "@/lib/storage";

/** Winners down the side, awards across the top, how many times in between. */
export function LeaderboardTable({ board }: { board: Leaderboard }) {
  if (board.rows.length === 0) return <EmptyState title="Nothing published yet." />;
  return (
    <div className="rounded-xl border">
      {/* Award names are long and there are many of them: let the table keep its
          width and scroll sideways rather than squeeze the headings together. */}
      <Table className="min-w-max">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead className="sticky left-0 bg-background">Member</TableHead>
            {board.types.map((t) => (
              <TableHead key={t.id} className="px-3 text-right">
                {t.name}
              </TableHead>
            ))}
            <TableHead className="px-3 text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {board.rows.map((r, i) => (
            <TableRow key={r.memberId}>
              <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
              <TableCell className="sticky left-0 bg-background">
                <div className="flex items-center gap-2">
                  <MemberAvatar name={r.name} src={publicUrl(r.photoKey)} className="size-8" />
                  <span className="font-medium">{r.name}</span>
                </div>
              </TableCell>
              {board.types.map((t) => (
                <TableCell key={t.id} className="px-3 text-right tabular-nums">
                  {r.counts.get(t.id) ?? <span className="text-muted-foreground/50">–</span>}
                </TableCell>
              ))}
              <TableCell className="px-3 text-right font-semibold tabular-nums">{r.total}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
