"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { venue } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { assertCap } from "@/lib/session";

const venueSchema = z.object({
  name: z.string().trim().min(2, "Name the venue").max(120),
  address: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null),
});

export async function saveVenue(id: string | null, input: z.input<typeof venueSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const me = await assertCap("meetings.manage");
    const data = venueSchema.parse(input);
    if (id) {
      const [before] = await db.select().from(venue).where(eq(venue.id, z.uuid().parse(id)));
      if (!before) throw new UserError("Venue not found.");
      await db.update(venue).set(data).where(eq(venue.id, before.id));
      await audit({ actorId: me.id, action: "venue.update", entity: "venue", entityId: before.id, before, after: data });
      refresh();
      return { id: before.id };
    }
    const [row] = await db.insert(venue).values(data).returning({ id: venue.id });
    await audit({ actorId: me.id, action: "venue.create", entity: "venue", entityId: row.id, after: data });
    refresh();
    return { id: row.id };
  });
}

