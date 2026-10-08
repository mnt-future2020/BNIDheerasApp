import type { QuizStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

/** What the chapter calls each stage, rather than the word in the column. */
export const QUIZ_STATUS_LABELS: Record<QuizStatus, string> = {
  draft: "Draft",
  open: "Open for joining",
  live: "Being played",
  ended: "Finished",
};

const STYLES: Record<QuizStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  open: "bg-sky-100 text-sky-800 border-sky-200",
  live: "bg-green-100 text-green-800 border-green-200",
  ended: "bg-violet-100 text-violet-800 border-violet-200",
};

export function QuizStatusBadge({ status, className }: { status: QuizStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-xs font-semibold",
        STYLES[status],
        className,
      )}
    >
      {QUIZ_STATUS_LABELS[status]}
    </span>
  );
}
