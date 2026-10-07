"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
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
          await chooseTenure(id);
          router.refresh();
        })
      }
    >
      <SelectTrigger size="sm" className="w-auto max-w-52 gap-1 border-0 px-1.5 font-medium text-foreground shadow-none" aria-label="Tenure">
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
