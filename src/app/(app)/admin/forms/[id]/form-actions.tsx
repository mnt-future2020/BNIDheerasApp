"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteForm, setFormActive } from "@/actions/forms";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";

/**
 * Stopping a form and deleting it sit together, because they are easy to
 * confuse and only one of them loses anything. Pausing is a single tap with no
 * confirmation — it takes nothing away and the same tap puts it back.
 */
export function FormActions({ id, isActive, responses }: { id: string; isActive: boolean; responses: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setFormActive(id, !isActive);
            if (!res.ok) return void toast.error(res.error);
            toast.success(isActive ? "Paused. The link now says the form is closed." : "Open again.");
            router.refresh();
          })
        }
      >
        {isActive ? <PauseIcon /> : <PlayIcon />}
        {isActive ? "Pause" : "Reopen"}
      </Button>
      <ConfirmButton
        label="Delete"
        title="Delete this form?"
        description={
          responses > 0
            ? `The form and all ${responses} answer${responses === 1 ? "" : "s"} go with it, and the link stops working. Download the answers first if you want to keep them.`
            : "The form goes, and its link stops working."
        }
        success="Deleted."
        action={() => deleteForm(id)}
        redirectTo="/admin/forms"
      />
    </>
  );
}
