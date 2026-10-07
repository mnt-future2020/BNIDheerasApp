"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { approveDevice, revokeDevice } from "@/actions/device";
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

/** Both of these live in a member's Action list on /admin/members. */
export function ApproveDeviceButton({
  id,
  name,
  code,
  className,
}: {
  id: string;
  name: string;
  code: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className={className} disabled={pending}>
          Approve
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve {name}&apos;s phone?</AlertDialogTitle>
          <AlertDialogDescription>
            Check that {name} is holding the phone and its screen shows code <b>{code}</b>. Their previous phone will stop
            working for check-in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              start(async () => {
                const res = await approveDevice(id);
                if (!res.ok) return void toast.error(res.error);
                toast.success(`${name}'s phone approved.`);
                // The member's Action list is open on top of this: pull the new
                // status down so it stops offering Approve.
                router.refresh();
              })
            }
          >
            Approve
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Removes an approved phone, or rejects one waiting for approval (`pending`). */
export function RevokeDeviceButton({
  id,
  name,
  pending: isPending = false,
  className,
}: {
  id: string;
  name: string;
  pending?: boolean;
  className?: string;
}) {
  const [reason, setReason] = useState("");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={isPending ? "outline" : "ghost"}
          size={isPending ? "default" : "sm"}
          className={className}
          disabled={pending}
        >
          {isPending ? "Reject" : "Remove"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isPending ? "Reject" : "Remove"} {name}&apos;s phone?</AlertDialogTitle>
          <AlertDialogDescription>
            {isPending
              ? "It won’t be approved for check-in. The member is notified and can register again."
              : "It will stop working for check-in immediately. The member is notified."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          placeholder={isPending ? "Reason (e.g. not their phone)" : "Reason (e.g. lost phone)"}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={reason.trim().length < 3}
            onClick={() =>
              start(async () => {
                const res = await revokeDevice(id, reason);
                if (!res.ok) return void toast.error(res.error);
                toast.success(isPending ? "Request rejected." : "Phone removed.");
                setReason("");
                router.refresh();
              })
            }
          >
            {isPending ? "Reject" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
