import type { MetadataRoute } from "next";
import { iconUrl } from "@/lib/app-icons";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "We Are Dheeras",
    short_name: "We Are Dheeras",
    description: "BNI Dheeras chapter app",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#cf2030",
    // The glossy WE ARE / DHEERAS tile, built by scripts/make-icons.py. Versioned
    // URLs, so a phone fetches new artwork instead of the icon it cached.
    icons: [
      { src: iconUrl("/icons/app-192.png"), sizes: "192x192", type: "image/png" },
      { src: iconUrl("/icons/app-512.png"), sizes: "512x512", type: "image/png" },
      { src: iconUrl("/icons/app-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
