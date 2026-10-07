"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { setDefaultPassword } from "@/lib/passwords";
import { assertCap } from "@/lib/session";
import { CHAPTER_ADMIN_MAX_LENGTH } from "@/lib/format";
import { CHAPTER_ADMIN_KEY, getChapterAdmin, setChapterAdmin } from "@/lib/settings";
/** The shared first-time password. Members still on the old default move to the new one. */
export async function saveDefaultPassword(value: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("settings.manage");
    await setDefaultPassword(z.string().parse(value), me.id);
    // The password itself stays out of the audit log.
    await audit({ actorId: me.id, action: "settings.default_password", entity: "setting", entityId: "defaultPassword" });
    refresh();
    return null;
  });
}

/** The chapter's Admin. Kept with the chapter, so every new tenure inherits it. */
export async function saveChapterAdmin(value: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("settings.manage");
    const name = z.string().max(CHAPTER_ADMIN_MAX_LENGTH, "That name is too long.").parse(value).trim();
    if (name && name.length < 2) throw new UserError("Enter the full name.");
    const before = await getChapterAdmin();
    await setChapterAdmin(name, me.id);
    await audit({
      actorId: me.id,
      action: "settings.chapter_admin",
      entity: "setting",
      entityId: CHAPTER_ADMIN_KEY,
      before: { name: before },
      after: { name },
    });
    refresh();
    return null;
  });
}
