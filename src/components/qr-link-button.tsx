"use client";

import { CheckIcon, MonitorIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Copies the venue screen's address for this meeting. The screen is a different
 * device from the phone in your hand, so the link has to travel — opening it
 * here would only put the QR on the wrong screen.
 */
export function CopyQrLinkButton({ meetingId }: { meetingId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      onClick={async () => {
        const url = `${window.location.origin}/kiosk/${meetingId}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          return void toast.error(`Couldn't copy. The link is ${url}`);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        toast.success("QR link copied. Open it on the venue screen.");
      }}
    >
      {copied ? <CheckIcon /> : <MonitorIcon />} Copy QR link
    </Button>
  );
}
