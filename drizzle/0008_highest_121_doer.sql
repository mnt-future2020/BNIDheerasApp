-- "Highest 121 Doer" joins the weekly recognitions, read and entered like the
-- other two that are counted: a winner, and the number beside their name.
-- It slots in after Top Business Giver so the counted awards read together,
-- which pushes everything from Best Attire down by one place.
--
-- Only for a chapter that already has its recognitions. A brand-new database
-- is still filled by ensureDefaults() from src/lib/award-defaults.ts, which
-- only runs while the table is empty — inserting here first would leave it
-- with this one award and nothing else.
UPDATE "award_type" SET "sort_order" = "sort_order" + 1 WHERE "sort_order" >= 2;--> statement-breakpoint
INSERT INTO "award_type" ("id", "name", "sort_order", "is_active", "note_enabled", "value_enabled", "value_hint")
SELECT gen_random_uuid()::text, 'Highest 121 Doer', 2, true, true, true, 'e.g. 6 one-to-ones'
WHERE EXISTS (SELECT 1 FROM "award_type")
ON CONFLICT ("name") DO NOTHING;
