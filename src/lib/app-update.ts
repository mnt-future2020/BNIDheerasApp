/**
 * "A newer build is live" state for useSyncExternalStore — the other half of
 * `install-app.ts`. Once the app is on a member's home screen there is no app
 * store to push a new version: the installed app opens the copy of the
 * JavaScript it downloaded the day it was installed and, because members never
 * close it, can keep running that copy for weeks after a deployment.
 *
 * So Home asks the server which build it is serving and compares it with the
 * build this window is running. When they differ it offers Update in the slot
 * where a browser is offered Install.
 *
 * There is no service worker to wake up: every page a member sees is rendered
 * per request and sent `no-store`, so reloading is all it takes to come up on
 * the new build.
 */

import { APP_BUILD } from "@/lib/app-build";

/** A chapter app gains a feature a few times a term, so this is not a poll race. */
const CHECK_MS = 15 * 60 * 1000;

let live = APP_BUILD;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * Whether to offer the update, given the build running here and the one the
 * server reports. An unknown build on either side means we cannot tell, and an
 * update that isn't there is worse than none: it would sit on Home for the rest
 * of the term, reloading onto itself.
 */
export function updateOffered(running: string, live: string | undefined): boolean {
  return running !== "" && !!live && live !== running;
}

/** True once the server has told us it is serving a different build from this one. */
export function getUpdateState(): boolean {
  return updateOffered(APP_BUILD, live);
}

/** Nothing is stale in the markup the server just rendered. */
export const getServerUpdateState = (): boolean => false;

/**
 * One check. Quiet about failures: being offline, or asleep in the background,
 * is the normal reason this fails on a phone, and the next check will do.
 */
export async function checkForUpdate(): Promise<void> {
  if (APP_BUILD === "") return; // Built without a version to compare: nothing to ask about.
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return;
    const { build } = (await res.json()) as { build?: string };
    if (!build || build === live) return;
    live = build;
    emit();
  } catch {
    return;
  }
}

let timer: ReturnType<typeof setInterval> | undefined;

const onVisible = () => {
  if (document.visibilityState === "visible") void checkForUpdate();
};

export function subscribeUpdate(onChange: () => void) {
  listeners.add(onChange);
  // Coming back to the foreground is the moment that matters: the installed app
  // may have been sitting behind WhatsApp since before the deployment.
  if (listeners.size === 1) {
    void checkForUpdate();
    timer = setInterval(() => void checkForUpdate(), CHECK_MS);
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

/** Comes back up on the new build. */
export async function applyUpdate(): Promise<void> {
  // Nothing here writes to Cache Storage, but a home-screen app carries
  // whatever it has collected since it was installed, and an iPhone will serve
  // those files again after the reload. Clearing them first is what makes the
  // Update button mean the same thing on every phone.
  try {
    if ("caches" in window) await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
  } catch {
    // Not fatal: the reload still asks the server for the new build.
  }
  location.reload();
}
