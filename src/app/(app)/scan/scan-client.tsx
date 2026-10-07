"use client";

import { CheckCircle2Icon, Loader2Icon, ScanLineIcon, XCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { checkIn } from "@/actions/checkin";
import { DeviceCard, type DeviceSummary, useLocalDevice } from "@/components/device-card";
import { QrScanner } from "@/components/qr-scanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signedPayload } from "@/lib/attendance/payloads";
import { REJECTION_MESSAGES } from "@/lib/attendance/rules";
import type { CheckinResult } from "@/lib/attendance/service";
import { deviceThumbprint, getDeviceKey, signWithDevice } from "@/lib/device-key";
import { formatTime } from "@/lib/time";

type Phase = "idle" | "scanning" | "submitting" | "done";

export function ScanClient({ memberId, devices }: { memberId: string; devices: DeviceSummary[] }) {
  const router = useRouter();
  const [local] = useLocalDevice(devices);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [problem, setProblem] = useState("");

  async function submit(qrToken: string) {
    setProblem("");
    setPhase("submitting");
    try {
      const key = await getDeviceKey();
      if (!key) throw new Error("This phone isn't registered.");
      const thumbprint = await deviceThumbprint(key.publicJwk);
      const signature = await signWithDevice(signedPayload.checkin(memberId, qrToken));
      const res = await checkIn({ qrToken, thumbprint, signature });
      setResult(res);
    } catch (e) {
      setResult({ ok: false, reason: "bad_signature" });
      setProblem((e as Error).message);
    }
    setPhase("done");
    router.refresh();
  }

  if (local.kind !== "approved") {
    return (
      <div className="space-y-4">
        <DeviceCard memberId={memberId} devices={devices} />
        <p className="text-sm text-muted-foreground">
          Check-in works only from your approved phone. Once it&apos;s approved, come back here and scan the QR on the
          venue screen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
        {phase === "idle" ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
              <ScanLineIcon className="size-14 text-primary" />
              <div>
                <p className="font-semibold">Point your camera at the QR on the venue screen</p>
                <p className="text-sm text-muted-foreground">The QR changes every 15 seconds.</p>
              </div>
              <Button size="lg" className="h-12 w-full max-w-xs text-base" onClick={() => setPhase("scanning")}>
                Start scanning
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {phase === "scanning" ? (
          <div className="space-y-3">
            <QrScanner accept={(v) => v.startsWith("BNID1.")} onScan={submit} />
            <Button variant="outline" className="w-full" onClick={() => setPhase("idle")}>
              Cancel
            </Button>
          </div>
        ) : null}

        {phase === "submitting" ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2Icon className="size-10 animate-spin text-primary" />
              <p className="font-medium">Checking you in…</p>
            </CardContent>
          </Card>
        ) : null}

        {phase === "done" && result ? (
          <ResultCard
            result={result}
            problem={problem}
            onAgain={() => {
              setResult(null);
              setPhase("scanning");
            }}
            onDone={() => router.push("/")}
          />
        ) : null}
    </div>
  );
}

function ResultCard({
  result,
  problem,
  onAgain,
  onDone,
}: {
  result: CheckinResult;
  problem: string;
  onAgain: () => void;
  onDone: () => void;
}) {
  if (result.ok) {
    const late = result.status === "L";
    return (
      <Card className={late ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50"}>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2Icon className={`size-16 ${late ? "text-amber-600" : "text-green-600"}`} />
          <div>
            <p className="text-xl font-bold">
              {result.already ? "Already checked in" : late ? "Checked in — Late" : "Checked in — On time"}
            </p>
            <p className="text-sm text-muted-foreground">
              {result.meetingTitle} · {formatTime(new Date(result.checkedInAt))}
            </p>
          </div>
          <Button className="mt-2 w-full max-w-xs" onClick={onDone}>
            Done
          </Button>
        </CardContent>
      </Card>
    );
  }
  const message = REJECTION_MESSAGES[result.reason] ?? "Check-in failed.";
  return (
    <Card className="border-red-300 bg-red-50">
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <XCircleIcon className="size-14 text-red-600" />
        <p className="font-semibold">{message}</p>
        {problem ? <p className="text-sm text-muted-foreground">{problem}</p> : null}
        <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
          <Button onClick={onAgain}>Scan again</Button>
          <Button variant="outline" onClick={onDone}>
            Back to Home
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Still stuck? Ask the LVH team at the door.
        </p>
      </CardContent>
    </Card>
  );
}
