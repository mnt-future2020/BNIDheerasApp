"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { pairKiosk } from "@/actions/kiosk";

/**
 * The screen was opened with a Copy QR link, which carries a pairing code. It
 * pairs itself and goes on to the QR, so there is nothing to type at the venue.
 *
 * The pairing is a POST, not the page load: a link pasted into a chat gets
 * fetched by the preview bot, and a code spent on a preview would leave the
 * real screen with nothing.
 */
export function AutoPair({ meetingId, code }: { meetingId: string; code: string }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    (async () => {
      const data = new FormData();
      data.set("code", code);
      const res = await pairKiosk(null, data);
      // Either way the code is spent, so the address bar should not keep it.
      router.replace(res.ok ? `/kiosk/${meetingId}` : "/kiosk");
      router.refresh();
    })();
  }, [code, meetingId, router]);
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <p className="text-muted-foreground">Setting up this screen…</p>
    </main>
  );
}
