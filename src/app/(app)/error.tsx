"use client";

import { RefreshCwIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { PageContainer } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { applyUpdate, checkForUpdate, getServerUpdateState, getUpdateState, subscribeUpdate } from "@/lib/app-update";

/**
 * What a member sees when a page inside the app fails.
 *
 * One cause is common enough to name: the chapter deployed while their app was
 * open, so the copy they are running asks for files and server actions that
 * belong to a build the server no longer has. Trying again cannot fix that —
 * the app has to come back up on the new version — so this asks what is live
 * before deciding which way out to offer, rather than sending a member round
 * a Try again button that cannot work.
 */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const updateAvailable = useSyncExternalStore(subscribeUpdate, getUpdateState, getServerUpdateState);

  useEffect(() => {
    console.error(error);
    // Past the once-a-day throttle: a page that has just broken is worth asking about.
    void checkForUpdate(true);
  }, [error]);

  return (
    <PageContainer>
      <Card>
        <CardContent className="space-y-4">
          <div>
            <h1 className="text-lg font-semibold">
              {updateAvailable ? "The app has been updated" : "Something went wrong"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {updateAvailable
                ? "The chapter updated the app while you had it open. Open it again on the new version to carry on — you stay signed in."
                : "That page didn't load. Try it again; if it keeps happening, open the app again."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {updateAvailable ? (
              <Button onClick={() => void applyUpdate()}>
                <RefreshCwIcon /> Update
              </Button>
            ) : (
              <>
                <Button onClick={() => retry()}>
                  <RotateCcwIcon /> Try again
                </Button>
                <Button variant="outline" onClick={() => void applyUpdate()}>
                  <RefreshCwIcon /> Open again
                </Button>
              </>
            )}
          </div>

          {/* What the Head Table can read out to whoever looks at the server log. */}
          {error.digest ? <p className="text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
