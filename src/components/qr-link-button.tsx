"use client";

import { CheckIcon, MonitorIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { newPairingCode } from "@/actions/kiosk";
import { Button } from "@/components/ui/button";

/**
 * Copies the venue screen's address for this meeting. The screen is a different
 * device from the phone in your hand, so the link has to travel — opening it
 * here would only put the QR on the wrong screen.
 *
 * The link carries a fresh pairing code, so opening it on the venue screen goes
 * straight to this meeting's QR with nothing to type. The code is made on the
 * tap, lasts ten minutes and works once.
 */
export function CopyQrLinkButton({ meetingId }: { meetingId: string }) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await newPairingCode("Venue screen");
          if (!res.ok) return void toast.error(res.error);
          const url = `${window.location.origin}/kiosk/${meetingId}?pair=${res.data.code}`;
          try {
            await navigator.clipboard.writeText(url);
          } catch {
            return void toast.error(`Couldn't copy. The link is ${url}`);
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
          toast.success("QR link copied. Open it on the venue screen within 10 minutes.");
        })
      }
    >
      {copied ? <CheckIcon /> : <MonitorIcon />} Copy QR link
    </Button>
  );
}
