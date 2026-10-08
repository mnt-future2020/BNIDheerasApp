"use client";

import { CheckIcon, CopyIcon, ExternalLinkIcon, MessageCircleIcon } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuizStatus } from "@/db/schema";

/**
 * The QR and the link that let someone play. Both carry the same join token, so
 * the QR is for the room's screen and the link is for WhatsApp — a visitor with
 * no app account can play from either.
 */
export function QuizShare({
  name,
  joinToken,
  url,
  status,
  questionCount,
}: {
  name: string;
  joinToken: string;
  /** The absolute join address, resolved on the server. */
  url: string;
  status: QuizStatus;
  questionCount: number;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 720, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(null));
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return void toast.error(`Couldn't copy. The link is ${url}`);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Join link copied. Paste it into the WhatsApp group.");
  };

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Join the "${name}" quiz: ${url}`)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Join link &amp; QR</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="shrink-0">
          {qr ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qr}
              alt={`QR code to join the ${name} quiz`}
              className="size-44 rounded-xl border bg-white p-2"
            />
          ) : (
            <div className="size-44 animate-pulse rounded-xl bg-muted" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1.5">
            <div className="text-sm font-medium">Anyone with this link can play</div>
            <div className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs break-all">{url}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={copy}>
              {copied ? <CheckIcon /> : <CopyIcon />} Copy link
            </Button>
            <Button variant="outline" asChild>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircleIcon /> Send on WhatsApp
              </a>
            </Button>
            <Button variant="ghost" asChild>
              <a href={`/quiz/${joinToken}`} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon /> Open as a player
              </a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {status === "draft"
              ? questionCount === 0
                ? "The link won't work until the quiz has a question and you open it for joining."
                : "The link won't work until you open the quiz for joining."
              : status === "ended"
                ? "The quiz has finished, so the link now only shows the final places."
                : "Put the QR on the venue screen and send the link to the group — a visitor can play without an account."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
