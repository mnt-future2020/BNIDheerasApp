/**
 * Which build of the app this code came from, written in by `env` in
 * next.config.mjs at build time.
 *
 * The same literal ends up in two places: in the JavaScript the member's
 * browser downloads, and in the server bundle that answers /api/version. An
 * installed app that has been open since before a deployment therefore holds
 * the old id while the server reports the new one, which is what
 * `app-update.ts` watches for.
 *
 * Read as a whole member expression on purpose — `process.env` is replaced
 * key by key at build time, so destructuring it would leave `undefined`.
 */
export const APP_BUILD = process.env.NEXT_PUBLIC_APP_BUILD ?? "";
