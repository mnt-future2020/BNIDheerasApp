"use client";

import { CheckIcon, LinkIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { formatShortDate } from "@/lib/time";

/** Green only for a form that is actually taking answers; everything else is quiet. */
const STATE_BADGE: Record<FormState, { label: string; className: string }> = {
  open: { label: "Open", className: "border-transparent bg-emerald-600 text-white" },
  paused: { label: "Paused", className: "" },
  not_open_yet: { label: "Not open yet", className: "" },
  closed: { label: "Closed", className: "" },
  full: { label: "Full", className: "" },
};

/**
 * One form in the list. The link is the thing most often wanted — it is what
 * gets pasted into the chapter's WhatsApp group — so copying it is a button
 * here rather than something to open the form and go looking for.
 */
export function FormRow({
  id,
  slug,
  title,
  questions,
  responses,
  visibility,
  state,
  closesAt,
}: {
  id: string;
  slug: string;
  title: string;
  questions: number;
  responses: number;
  visibility: "public" | "members";
  state: FormState;
  closesAt: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const badge = STATE_BADGE[state];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 first:rounded-t-xl last:rounded-b-xl">
      <div className="min-w-0 flex-1">
        <Link href={`/admin/forms/${id}`} className="truncate font-medium hover:underline">
          {title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <Badge variant="secondary" className={`font-normal ${badge.className}`}>
            {badge.label}
          </Badge>
          {visibility === "members" ? <span>Members only</span> : <span>Anyone with the link</span>}
          <span>· {questions} question{questions === 1 ? "" : "s"}</span>
          {closesAt ? <span>· closes {formatShortDate(new Date(closesAt))}</span> : null}
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={async () => {
          const url = `${window.location.origin}/f/${slug}`;
          try {
            await navigator.clipboard.writeText(url);
          } catch {
            return void toast.error(`Couldn't copy. The link is ${url}`);
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
          toast.success("Link copied. Paste it wherever the chapter will see it.");
        }}
      >
        {copied ? <CheckIcon /> : <LinkIcon />} Copy link
      </Button>

      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/forms/${id}/responses`}>
          {responses} answer{responses === 1 ? "" : "s"}
        </Link>
      </Button>
    </div>
  );
}
