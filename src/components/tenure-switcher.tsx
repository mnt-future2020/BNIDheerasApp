"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { chooseTenure } from "@/actions/tenure";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tenure } from "@/lib/tenure";

/**
 * Which tenure the app is showing. Meetings, PALMS, recognitions and events all
 * follow it; the roster and everyone's permissions do not.
 */
export function TenureSwitcher({ tenures, selected }: { tenures: Tenure[]; selected: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (tenures.length === 0) return null;
  return (
    <Select
      value={selected}
      disabled={pending}
      onValueChange={(id) =>
        start(async () => {
          // chooseTenure only sets a cookie — there is nothing it can refuse.
          await chooseTenure(id);
          router.refresh();
          // Every list on the page quietly changes underneath, so say so.
          const name = tenures.find((t) => t.id === id)?.name;
          toast.success(name ? `Showing ${name}.` : "Tenure changed.");
        })
      }
    >
      {/* `min-w-0` so the name is what gives way when the header runs out of
          room: the trigger is nowrap, and without it the row pushes the avatar
          off a narrow screen instead of clamping the tenure to one line. */}
      <SelectTrigger
        size="sm"
        className="w-auto min-w-0 max-w-32 gap-1 border-0 bg-transparent px-2 font-medium text-foreground shadow-none sm:max-w-44 lg:max-w-52"
        aria-label="Tenure"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {tenures.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
