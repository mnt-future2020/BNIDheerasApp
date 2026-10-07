"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { changeOwnPassword } from "@/actions/auth";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { Label } from "@/components/ui/label";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/format";

/** `stacked` for a narrow place such as a dialog; otherwise three across. */
export function ChangePasswordForm({ stacked, onDone }: { stacked?: boolean; onDone?: () => void }) {
  const [state, action] = useActionState(changeOwnPassword, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Password changed. You're still signed in.");
      form.current?.reset();
      onDone?.();
    } else {
      toast.error(state.error);
    }
  }, [state, onDone]);

  return (
    <form ref={form} action={action} className={stacked ? "grid gap-3" : "grid gap-3 sm:grid-cols-3"}>
      <div className="space-y-1.5">
        <Label htmlFor="current">Current password</Label>
        <PasswordInput id="current" name="current" autoComplete="current-password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">New password</Label>
        <PasswordInput
          id="new-password"
          name="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Type it again</Label>
        <PasswordInput
          id="confirm-password"
          name="confirm"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          required
        />
      </div>
      <div className={stacked ? "" : "sm:col-span-3"}>
        <SubmitButton variant={stacked ? "default" : "outline"}>Change password</SubmitButton>
      </div>
    </form>
  );
}
