"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteFeedback, reviewFeedback } from "@/actions/feedback";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import type { FeedbackStatus } from "@/db/schema";

/**
 * The two decisions the Head Table makes, and the reply each one sends. The
 * member is notified with this wording, so it is written for them to read.
 */
const DECISIONS = {
  consider: {
    status: "in_progress" as FeedbackStatus,
    reply: "Thank you for this. The Head Table will consider it and take it forward.",
    toast: "Marked as being considered. The member has been told.",
  },
  decline: {
    status: "done" as FeedbackStatus,
    reply:
      "Thank you for taking the time to share this. The Head Table has looked at it and won't be taking it forward for now.",
    toast: "Marked as not taken forward. The member has been told.",
  },
};

/** One submission: consider it, don't, or delete it. */
export function FeedbackReview({ id, status, response }: { id: string; status: FeedbackStatus; response: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const decide = (which: keyof typeof DECISIONS) =>
    start(async () => {
      const d = DECISIONS[which];
      const res = await reviewFeedback({ id, status: d.status, response: d.reply });
      if (!res.ok) return void toast.error(res.error);
      toast.success(d.toast);
      router.refresh();
    });

  return (
    <div className="space-y-2">
      {response ? (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="text-xs text-muted-foreground">Sent to the member</div>
          <p className="mt-0.5 whitespace-pre-line">{response}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {/* The decision already made is settled, so only the other one is live. */}
        <Button
          size="sm"
          variant={status === "in_progress" ? "default" : "outline"}
          disabled={pending || status === "in_progress"}
          onClick={() => decide("consider")}
        >
          <CheckIcon /> {status === "in_progress" ? "Considering" : "Consider"}
        </Button>
        <Button
          size="sm"
          variant={status === "done" ? "default" : "outline"}
          disabled={pending || status === "done"}
          onClick={() => decide("decline")}
        >
          <XIcon /> {status === "done" ? "Not taken forward" : "Not consider"}
        </Button>
        <div className="ml-auto">
          <ConfirmButton
            label="Delete"
            title="Delete this submission?"
            description="It's removed for good, for you and the member."
            success="Deleted."
            action={() => deleteFeedback(id)}
          />
        </div>
      </div>
    </div>
  );
}
