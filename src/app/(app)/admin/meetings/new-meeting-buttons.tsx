"use client";

import { CalendarPlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MeetingForm, type MeetingFormValues, type VenueOption } from "./meeting-form";

/**
 * Creating meetings is an action, not a list, so it sits on a button rather
 * than a tab beside Today, Upcoming and Past. One meeting at a time: a
 * training or a social is an Event, under Admin → Calendar.
 */
export function NewMeetingButton({ venues, blank }: { venues: VenueOption[]; blank: MeetingFormValues }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CalendarPlusIcon /> Create meeting
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create meeting</DialogTitle>
            <DialogDescription>
              The chapter meeting at its usual hall. One per date and time: a second at the same moment is refused.
            </DialogDescription>
          </DialogHeader>
          {/* Unmounted while closed, so reopening starts from empty boxes again. */}
          {open ? <MeetingForm mode="create" venues={venues} initial={blank} onDone={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
