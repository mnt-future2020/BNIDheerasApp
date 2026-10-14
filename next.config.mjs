import { execFileSync } from "node:child_process";

// Plain .mjs on purpose: a next.config.ts has to be transpiled first, which
// writes a temp "<hash>.next.config" beside it and imports that back. Some
// build hosts never see that file, and the build dies with ERR_MODULE_NOT_FOUND
// before any of our code runs. Loaded as-is, there is nothing to go missing.

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Camera (QR scanning) and location (check-in, near me) are used by this site only.
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
];

/* Which version of the app a build is. `env` writes it into the bundle as a
   literal, so the browser keeps the id it downloaded while a redeployed server
   answers /api/version with its own, newer one; Home turns that difference into
   the Update button (src/lib/app-update.ts).

   It has to be the commit, or something else fixed: this file is read several
   times per build (once per compiler, and again by `next start`), so anything
   generated on the spot — a date, a random id — would differ between the
   browser's copy and the server's and offer an update that isn't there.

   Without a repository to ask, `NEXT_DEPLOYMENT_ID` can carry the version
   instead. With neither, the build says so below and the Update button stays
   away, which is the safe way to be wrong. */
const appBuild = process.env.NEXT_DEPLOYMENT_ID?.trim() || commitId();

function commitId() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

if (!appBuild && process.env.npm_lifecycle_event?.startsWith("build")) {
  console.warn(
    "No commit to version this build with (no git here?). Members will not be offered the update;" +
      " set NEXT_DEPLOYMENT_ID to the version being deployed to turn it back on.",
  );
}

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactCompiler: true,
  env: { NEXT_PUBLIC_APP_BUILD: appBuild },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
