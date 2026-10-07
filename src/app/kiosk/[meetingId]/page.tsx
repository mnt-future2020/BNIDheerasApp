import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getMeetingWithVenue } from "@/lib/attendance/queries";
import { kioskAccess } from "@/lib/kiosk";
import { AutoPair } from "./auto-pair";
import { KioskDisplay } from "./kiosk-display";

export const metadata: Metadata = { title: "Check-in QR" };

export default async function KioskMeetingPage({ params, searchParams }: PageProps<"/kiosk/[meetingId]">) {
  const { meetingId } = await params;
  if (!(await kioskAccess())) {
    // Opened from a Copy QR link: pair with the code it carries, then come
    // back here. Anything else goes to the venue screen's own setup page.
    const { pair } = await searchParams;
    const code = typeof pair === "string" ? pair.replace(/\D/g, "") : "";
    if (code.length !== 6) redirect("/kiosk");
    return <AutoPair meetingId={meetingId} code={code} />;
  }
  const m = await getMeetingWithVenue(meetingId);
  if (!m) notFound();
  return <KioskDisplay meetingId={m.id} />;
}
