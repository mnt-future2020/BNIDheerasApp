import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

/* Self-hosted by Next (no request to Google at runtime). Poppins isn't a
   variable font, so only the weights the app uses are downloaded. */
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "BNI Dheeras", template: "%s · BNI Dheeras" },
  description: "BNI Dheeras chapter app: attendance, members, calendar, dance cards and more.",
  applicationName: "BNI Dheeras",
  appleWebApp: { capable: true, title: "BNI Dheeras", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#cf2030",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/* No height on <html>/<body>: a 100%-height document makes mobile Safari measure
   `position: fixed` against the document instead of the viewport, so the bottom
   navigation only snaps into place after a scroll. The app shell sets its own
   min-h-dvh, which is all the full-height we need. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} antialiased`}>
      <body className="bg-background">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster theme="light" position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
