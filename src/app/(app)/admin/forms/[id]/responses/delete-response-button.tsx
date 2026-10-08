"use client";

import { Trash2Icon } from "lucide-react";
import { deleteResponse } from "@/actions/forms";
import { ConfirmButton } from "@/components/confirm-button";

/** One answer out of the table — a test entry, or something sent twice. */
export function DeleteResponseButton({ id, who }: { id: string; who: string }) {
  return (
    <ConfirmButton
      label="Delete"
      ariaLabel={`Delete the answer from ${who}`}
      icon={<Trash2Icon />}
      iconOnly
      size="icon-sm"
      title="Delete this answer?"
      description={`The answer from ${who} is removed from the table and the CSV. It can't be brought back.`}
      success="Deleted."
      action={() => deleteResponse(id)}
    />
  );
}
