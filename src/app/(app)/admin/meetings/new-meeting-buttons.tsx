"use client";

import { CalendarPlusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MeetingForm, type MeetingFormValues, type VenueOption } from "./meeting-form";

/**
 * Creating meetings is an action, not a list, so it sits on a button rather
 * than a tab beside Today, Upcoming and Past.
 */
export function NewMeetingButtons({ venues, blank }: { venues: VenueOption[]; blank: MeetingFormValues }) {
  const [open, setOpen] = useState<"weekly" | "single" | null>(null);
  return (
    <>
      <Button onClick={() => setOpen("weekly")}>
        <CalendarPlusIcon /> Weekly series
      </Button>
      <Button variant="outline" onClick={() => setOpen("single")}>
        <PlusIcon /> One meeting
      </Button>
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{open === "single" ? "New meeting" : "New weekly series"}</DialogTitle>
            <DialogDescription>
              {open === "single"
                ? "One meeting: an event, a training or a visitor day."
                : "The same meeting every week. Weeks that already have one are skipped."}
            </DialogDescription>
          </DialogHeader>
          {/* Keyed so closing and reopening starts from empty boxes again. */}
          {open ? <MeetingForm key={open} mode={open} venues={venues} initial={blank} onDone={() => setOpen(null)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
