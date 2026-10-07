"use client";

import { KeyRoundIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { newPairingCode } from "@/actions/kiosk";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Pairs the projector laptop or TV, so it can show the check-in QR without
 * anyone's personal login staying open on it. The code is made on the tap, not
 * before: it is valid for ten minutes and once only.
 */
export function PairScreenButton() {
  const [code, setCode] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await newPairingCode("Venue screen");
            if (!res.ok) return void toast.error(res.error);
            setCode(res.data.code);
          })
        }
      >
        <KeyRoundIcon /> Show code
      </Button>
      <Dialog open={code !== null} onOpenChange={(o) => !o && setCode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pairing code</DialogTitle>
            <DialogDescription>
              On the venue screen, open <b>{typeof window === "undefined" ? "" : window.location.origin}/kiosk</b> and
              enter this code.
            </DialogDescription>
          </DialogHeader>
          <div className="text-center">
            <div className="my-2 flex items-center justify-center gap-2">
              <span className="font-mono text-4xl font-bold tracking-[0.3em]">{code}</span>
              {code ? <CopyButton value={code} label="Code" /> : null}
            </div>
            <p className="text-xs text-muted-foreground">Valid for 10 minutes, once.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
