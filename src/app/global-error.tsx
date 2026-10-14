"use client";

import { applyUpdate } from "@/lib/app-update";

/**
 * The last resort: the root layout itself failed, so this renders its own
 * document. Next serves it without the app's stylesheet or font, which is why
 * everything here is written in place — a screen that appears when the app is
 * already broken should not depend on anything else arriving.
 *
 * Open again, rather than Try again, leads: the usual way to end up here is a
 * deployment that landed while the app was open, and only a fresh start picks
 * up the new version.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "1.5rem",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: "var(--bg)",
          color: "var(--fg)",
        }}
      >
        <title>Something went wrong · We Are Dheeras</title>
        {/* The phone's own setting decides, the same way the app does. */}
        <style>{`
          :root { --bg: #ffffff; --fg: #1a1a1a; --muted: #5c5c5c; --line: #e4e4e7; }
          @media (prefers-color-scheme: dark) {
            :root { --bg: #0b0b0c; --fg: #f4f4f5; --muted: #a1a1aa; --line: #27272a; }
          }
        `}</style>

        <main style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.5rem" }}>The app needs to start again</h1>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.5, color: "var(--muted)", margin: "0 0 1.25rem" }}>
            This usually means the chapter app was updated while you had it open. Opening it again brings up the new
            version — you stay signed in.
          </p>

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void applyUpdate()}
              style={{
                font: "inherit",
                fontSize: "0.875rem",
                fontWeight: 500,
                padding: "0.5rem 0.875rem",
                borderRadius: "0.5rem",
                border: "1px solid transparent",
                background: "#cf2030",
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              Open again
            </button>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                font: "inherit",
                fontSize: "0.875rem",
                fontWeight: 500,
                padding: "0.5rem 0.875rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--line)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>

          {error.digest ? (
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "1.25rem" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
