"use client";

import { useCallback } from "react";
import { ChangePasswordForm } from "@/components/change-password-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Changing your own password is an account matter, not part of your business
 * profile, so it opens from the avatar menu wherever you are rather than
 * living on a page you have to go and find.
 */
export function ChangePasswordDialog({
  open,
  onOpenChange,
  loginId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The mobile number or email they sign in with, so the form names it. */
  loginId: string;
  onDone?: () => void;
}) {
  // Stable, so the form's "it worked" effect fires once and not on every render.
  const close = useCallback(() => {
    onOpenChange(false);
    onDone?.();
  }, [onOpenChange, onDone]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            You sign in with {loginId}. Forgot it later? Ask the President, VP or Secretary to reset it.
          </DialogDescription>
        </DialogHeader>
        <ChangePasswordForm stacked onDone={close} />
      </DialogContent>
    </Dialog>
  );
}
