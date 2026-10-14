/**
 * Bumped whenever scripts/make-icons.py changes the icons or launch screens.
 * public/ files are served with a year-long cache, and phones keep an
 * installed app's icon and splash under the URL they first fetched, so the
 * same URL would keep showing the old artwork. A new query string is a new URL.
 */
export const ICON_VERSION = "2";

/** A file under public/ (icons, splash), with the current icon version. */
export function iconUrl(path: string): string {
  return `${path}?v=${ICON_VERSION}`;
}
