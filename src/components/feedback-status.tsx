import { Badge } from "@/components/ui/badge";
import type { FeedbackStatus } from "@/db/schema";

/**
 * The Head Table decides with two buttons, Consider and Not consider, so the
 * three stored statuses read as the decision the member is waiting for.
 */
const LABELS: Record<FeedbackStatus, string> = { new: "Waiting", in_progress: "Considering", done: "Not taken forward" };

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  return <Badge variant={status === "done" ? "secondary" : status === "in_progress" ? "default" : "outline"}>{LABELS[status]}</Badge>;
}

export const FEEDBACK_STATUS_LABELS = LABELS;
