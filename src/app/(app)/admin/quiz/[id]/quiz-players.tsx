import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Who has joined. A guest came in from the link with nothing but a name, so the
 * badge is the only way to tell them from a member.
 */
export function QuizPlayers({ players }: { players: { id: string; name: string; memberId: string | null }[] }) {
  const guests = players.filter((p) => !p.memberId).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Joined{" "}
          <span className="font-normal text-muted-foreground">
            · {players.length}
            {guests ? `, ${guests} without an account` : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody yet. Names appear here as people open the link.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {players.map((p) => (
              <Badge key={p.id} variant={p.memberId ? "secondary" : "outline"}>
                {p.name}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
