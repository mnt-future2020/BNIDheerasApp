/**
 * Public base URL of the app, e.g. https://dheeras.example.com. Comes from
 * NEXT_PUBLIC_APP_URL; "" when it isn't set, so callers can fall back.
 */
export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
}

/** Every origin this deployment may be reached on. */
export function trustedOrigins(): string[] {
  return [
    ...new Set(
      [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL]
        .filter((u): u is string => !!u)
        .map((u) => u.replace(/\/+$/, "")),
    ),
  ];
}
