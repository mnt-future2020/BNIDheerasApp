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

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactCompiler: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
