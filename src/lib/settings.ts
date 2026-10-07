import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { setting } from "@/db/schema";

/* Older stored settings may still carry geofence and GPS keys; parsing drops them. */
export const attendanceSettingsSchema = z.object({
  checkinOpensBeforeMin: z.number().int().min(0).max(240),
  absenceLimit: z.number().int().min(1).max(12),
  absenceWindowMonths: z.number().int().min(1).max(12),
  lateFlagCount: z.number().int().min(1).max(12),
  lateFlagWeeks: z.number().int().min(1).max(26),
});
export type AttendanceSettings = z.infer<typeof attendanceSettingsSchema>;

/**
 * Not editable in the app: these are BNI policy and the check-in default, so
 * they come from here (or from a value stored earlier) rather than a form.
 */
export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  checkinOpensBeforeMin: 60,
  absenceLimit: 3,
  absenceWindowMonths: 6,
  lateFlagCount: 3,
  lateFlagWeeks: 8,
};

async function readSetting<T>(key: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  const [row] = await db.select().from(setting).where(eq(setting.key, key));
  if (!row) return fallback;
  const parsed = schema.safeParse(row.value);
  return parsed.success ? parsed.data : fallback;
}

export function getAttendanceSettings(): Promise<AttendanceSettings> {
  return readSetting("attendance", attendanceSettingsSchema, DEFAULT_ATTENDANCE_SETTINGS);
}

export const CHAPTER_ADMIN_KEY = "chapterAdmin";

/**
 * The chapter's Admin: a name the Head Table types once and leaves alone. It
 * belongs to the chapter, not to a tenure, so starting a new tenure carries it
 * over untouched — in practice it only changes every couple of years.
 */
export function getChapterAdmin(): Promise<string> {
  return readSetting(CHAPTER_ADMIN_KEY, z.string(), "");
}

export async function setChapterAdmin(value: string, actorId: string): Promise<void> {
  const name = value.trim();
  await db
    .insert(setting)
    .values({ key: CHAPTER_ADMIN_KEY, value: name, updatedById: actorId })
    .onConflictDoUpdate({ target: setting.key, set: { value: name, updatedById: actorId, updatedAt: new Date() } });
}
