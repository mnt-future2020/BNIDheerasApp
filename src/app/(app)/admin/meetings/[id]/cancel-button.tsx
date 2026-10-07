"use client";

import { CalendarOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelMeeting } from "@/actions/meetings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CancelMeetingButton({ id, iconOnly, redirectTo }: { id: string; iconOnly?: boolean; redirectTo?: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {iconOnly ? (
          <Button variant="ghost" size="icon-sm" aria-label="Cancel meeting" title="Cancel meeting">
            <CalendarOffIcon />
          </Button>
        ) : (
          <Button variant="destructive">Cancel meeting</Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this meeting?</AlertDialogTitle>
          <AlertDialogDescription>Nobody will be marked absent for a cancelled meeting.</AlertDialogDescription>
        </AlertDialogHeader>
        <Input placeholder="Reason (e.g. public holiday)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || reason.trim().length < 3}
            onClick={() =>
              start(async () => {
                const res = await cancelMeeting(id, reason);
                if (!res.ok) return void toast.error(res.error);
                setReason("");
                toast.success("Meeting cancelled.");
                // From the list the row is already in view: stay and refresh it.
                if (redirectTo) router.push(redirectTo);
                else router.refresh();
              })
            }
          >
            Cancel meeting
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
