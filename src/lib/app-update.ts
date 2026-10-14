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
 * Once a day. The chapter app is deployed a few times a term, so asking more
 * often only spends a phone's radio to hear the same answer; in practice this
 * lands on the first time a member opens the app each day, which is exactly
 * when being a version behind starts to matter to them.
 */
const ASK_EVERY_MS = 24 * 60 * 60 * 1000;
const ASKED_AT = "dheeras.update-asked-at";

/**
 * When we last got an answer. Private browsing refuses storage altogether, and
 * a day's throttle is not worth an exception: without it we simply fall back to
 * asking once per visit, which is what this did before.
 */
function askedAt(): number {
  try {
    return Number(localStorage.getItem(ASKED_AT)) || 0;
  } catch {
    return 0;
  }
}

function rememberAsked() {
  try {
    localStorage.setItem(ASKED_AT, String(Date.now()));
  } catch {
    return;
  }
}

/**
 * One check, at most once a day unless `force` says otherwise — the error
 * boundary forces one, because a page that has just broken is the one moment
 * where the answer decides what to offer the member.
 *
 * Quiet about failures: being offline, or asleep in the background, is the
 * normal reason this fails on a phone. A failed ask is not remembered either,
 * so a phone that was in the lift still gets its day's answer.
 */
export async function checkForUpdate(force = false): Promise<void> {
  if (APP_BUILD === "") return; // Built without a version to compare: nothing to ask about.
  if (!force && Date.now() - askedAt() < ASK_EVERY_MS) return;
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return;
    const { build } = (await res.json()) as { build?: string };
    rememberAsked();
    if (!build || build === live) return;
    live = build;
    emit();
  } catch {
    return;
  }
}

const onVisible = () => {
  if (document.visibilityState === "visible") void checkForUpdate();
};

/**
 * Asks when Home opens, and again whenever the app comes back to the
 * foreground — the installed app may have been sitting behind WhatsApp since
 * before the deployment — and `checkForUpdate` keeps that to once a day.
 *
 * Nothing on a timer. A deployment the member sleeps through is still there in
 * the morning, so there is nothing a clock would catch that opening the app
 * does not, and a phone in a pocket has better things to spend its radio on.
 */
export function subscribeUpdate(onChange: () => void) {
  listeners.add(onChange);
  if (listeners.size === 1) {
    void checkForUpdate();
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) document.removeEventListener("visibilitychange", onVisible);
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
