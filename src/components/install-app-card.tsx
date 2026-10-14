"use client";

import { DownloadIcon, RefreshCwIcon, ShareIcon } from "lucide-react";
import Image from "next/image";
import { useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { applyUpdate, getServerUpdateState, getUpdateState, subscribeUpdate } from "@/lib/app-update";
import { getInstallState, getServerInstallState, promptInstall, subscribeInstall } from "@/lib/install-app";

/** The app's own icon, so the card reads as being about the app on the phone. */
function AppCard({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <Image
          src="/icons/app-192.png"
          alt=""
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-xl ring-1 ring-foreground/10"
        />
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Home's one card about the app itself.
 *
 * Update comes first and shows wherever the member is, installed app included:
 * a home-screen app keeps running the JavaScript it was installed with, so the
 * member is the only one who can bring it up to date. With nothing to update it
 * falls back to the install offer — a phone browser, or a computer whose browser
 * can install it in one tap — and says nothing inside an up-to-date app.
 */
export function InstallAppCard() {
  const state = useSyncExternalStore(subscribeInstall, getInstallState, getServerInstallState);
  const updateAvailable = useSyncExternalStore(subscribeUpdate, getUpdateState, getServerUpdateState);
  const [pending, start] = useTransition();

  if (updateAvailable) {
    return (
      <AppCard>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Update available</div>
          <p className="text-sm text-muted-foreground">
            A newer version of the chapter app is ready. It opens again on the new one, still signed in.
          </p>
        </div>
        <Button disabled={pending} onClick={() => start(applyUpdate)}>
          <RefreshCwIcon /> Update
        </Button>
      </AppCard>
    );
  }

  if (state === "installed" || state === "hidden") return null;

  return (
    <AppCard>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Get the BNI Dheeras app</div>
        <p className="text-sm text-muted-foreground">
          {state === "ios" ? (
            <>
              Tap <ShareIcon className="inline size-4 align-text-bottom" aria-label="Share" /> Share, then{" "}
              <b>Add to Home Screen</b>. On iPhone, check-in works from the installed app.
            </>
          ) : state === "manual" ? (
            <>
              Open your browser menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>.
            </>
          ) : (
            "Opens straight from your home screen, like any other app."
          )}
        </p>
      </div>
      {state === "prompt" ? (
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (await promptInstall()) toast.success("Installed. Open BNI Dheeras from your home screen.");
            })
          }
        >
          <DownloadIcon /> Install
        </Button>
      ) : null}
    </AppCard>
  );
}
