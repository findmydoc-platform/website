import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "landing_pages_about_why_items" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "text" varchar NOT NULL
  );

  CREATE TABLE "landing_pages_about_team" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "name" varchar NOT NULL,
    "role" varchar NOT NULL,
    "image_id" integer NOT NULL,
    "what_we_do" varchar NOT NULL
  );

  CREATE TABLE "landing_pages_about_transparency_items" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "text" varchar NOT NULL
  );

  ALTER TABLE "landing_pages" ADD COLUMN "about_seo_title" varchar;
  ALTER TABLE "landing_pages" ADD COLUMN "about_seo_description" varchar;
  ALTER TABLE "landing_pages" ADD COLUMN "about_hero_title" varchar;
  ALTER TABLE "landing_pages" ADD COLUMN "about_hero_description" varchar;
  ALTER TABLE "landing_pages" ADD COLUMN "about_hero_image_id" integer;
  ALTER TABLE "landing_pages" ADD COLUMN "about_why_title" varchar;
  ALTER TABLE "landing_pages" ADD COLUMN "about_transparency_title" varchar;

    DO $$
    DECLARE
      missing_stable_ids text[];
    BEGIN
      WITH required_stable_ids("stable_id") AS (
        VALUES
          ('landing-clinic-partner-hero-turkey-tablet'),
          ('landing-team-volkan-kablan'),
          ('landing-team-youssef-adlah'),
          ('landing-team-anil-goekduman'),
          ('landing-team-oezen-guenes'),
          ('landing-team-sebastian-schuetze')
      )
      SELECT array_agg(required_stable_ids."stable_id" ORDER BY required_stable_ids."stable_id")
        INTO missing_stable_ids
      FROM required_stable_ids
      WHERE NOT EXISTS (
        SELECT 1
        FROM "platform_content_media"
        WHERE "platform_content_media"."stable_id" = required_stable_ids."stable_id"
      );

      IF COALESCE(array_length(missing_stable_ids, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Missing platformContentMedia stable IDs required for about landing page migration: %', array_to_string(missing_stable_ids, ', ');
      END IF;
    END $$;

    WITH hero_media AS (
      SELECT "id" FROM "platform_content_media" WHERE "stable_id" = 'landing-clinic-partner-hero-turkey-tablet' LIMIT 1
    )
    UPDATE "landing_pages"
    SET
    "about_seo_title" = 'About findmydoc | The team behind clearer clinic decisions',
    "about_seo_description" = 'Meet the team behind findmydoc and learn how we make clinic information clearer, more accountable, and easier to compare.',
    "about_hero_title" = 'Clearer clinic decisions start with better information.',
    "about_hero_description" = 'findmydoc helps patients compare clinic information with confidence and helps clinics present their services responsibly.',
    "about_hero_image_id" = (SELECT "id" FROM hero_media),
    "about_why_title" = 'Why we exist',
    "about_transparency_title" = 'What we keep transparent'
  WHERE "about_seo_title" IS NULL;

  INSERT INTO "landing_pages_about_why_items" ("_order", "_parent_id", "id", "text")
  SELECT 0, "id", CONCAT('about-why-clarity-', "id"), 'We bring clarity to clinic information so comparisons are fair and decisions are easier.'
  FROM "landing_pages"
  ON CONFLICT ("id") DO NOTHING;

  INSERT INTO "landing_pages_about_why_items" ("_order", "_parent_id", "id", "text")
  SELECT 1, "id", CONCAT('about-why-accountability-', "id"), 'We hold clinic information accountable through verification and responsible presentation.'
  FROM "landing_pages"
  ON CONFLICT ("id") DO NOTHING;

  INSERT INTO "landing_pages_about_why_items" ("_order", "_parent_id", "id", "text")
  SELECT 2, "id", CONCAT('about-why-next-step-', "id"), 'We keep the next step simple by connecting patients and clinics directly.'
  FROM "landing_pages"
  ON CONFLICT ("id") DO NOTHING;

    WITH team_source("order_idx", "item_id", "name", "role", "what_we_do", "stable_id") AS (
      VALUES
        (0, 'volkan-kablan', 'Volkan Kablan', 'CEO', 'Shape finance and partner operations so clinic growth stays sustainable, measurable, and transparent.', 'landing-team-volkan-kablan'),
        (1, 'youssef-adlah', 'Youssef Adlah', 'CMO', 'Lead growth and partnerships to connect the right patients with the right clinics through clear communication and strong relationships.', 'landing-team-youssef-adlah'),
      (2, 'anil-goekduman', 'Anil Gökduman', 'CPO', 'Own product strategy and user experience to make clinic comparisons simple, relevant, and trustworthy for patients.', 'landing-team-anil-goekduman'),
      (3, 'oezen-guenes', 'Özen Günes', 'CLO', 'Ensure legal integrity, data protection, and responsible engagement across all our relationships with patients and clinics.', 'landing-team-oezen-guenes'),
      (4, 'sebastian-schuetze', 'Sebastian Schütze', 'CTO', 'Build and maintain a secure, reliable platform so clinic information is structured, up to date, and easy to access.', 'landing-team-sebastian-schuetze')
    ),
    resolved_team AS (
      SELECT
        team_source.*,
        "platform_content_media"."id" AS "image_id"
      FROM team_source
      INNER JOIN "platform_content_media"
        ON "platform_content_media"."stable_id" = team_source."stable_id"
    )
    INSERT INTO "landing_pages_about_team" ("_order", "_parent_id", "id", "name", "role", "image_id", "what_we_do")
    SELECT resolved_team."order_idx", "landing_pages"."id", CONCAT('about-team-', resolved_team."item_id", '-', "landing_pages"."id"), resolved_team."name", resolved_team."role", resolved_team."image_id", resolved_team."what_we_do"
    FROM "landing_pages"
    CROSS JOIN resolved_team
    ON CONFLICT ("id") DO NOTHING;

  INSERT INTO "landing_pages_about_transparency_items" ("_order", "_parent_id", "id", "text")
  SELECT 0, "id", CONCAT('about-transparency-profile-owner-', "id"), 'Clinics own their profile information.'
  FROM "landing_pages"
  ON CONFLICT ("id") DO NOTHING;

  INSERT INTO "landing_pages_about_transparency_items" ("_order", "_parent_id", "id", "text")
  SELECT 1, "id", CONCAT('about-transparency-qualification-review-', "id"), 'Qualification signals are reviewed before visibility.'
  FROM "landing_pages"
  ON CONFLICT ("id") DO NOTHING;

  INSERT INTO "landing_pages_about_transparency_items" ("_order", "_parent_id", "id", "text")
  SELECT 2, "id", CONCAT('about-transparency-direct-contact-', "id"), 'Patients contact clinics directly.'
  FROM "landing_pages"
  ON CONFLICT ("id") DO NOTHING;

  ALTER TABLE "landing_pages" ALTER COLUMN "about_seo_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "about_seo_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "about_hero_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "about_hero_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "about_hero_image_id" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "about_why_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "about_transparency_title" SET NOT NULL;

  ALTER TABLE "landing_pages_about_why_items" ADD CONSTRAINT "landing_pages_about_why_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_about_team" ADD CONSTRAINT "landing_pages_about_team_image_id_platform_content_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "landing_pages_about_team" ADD CONSTRAINT "landing_pages_about_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_about_transparency_items" ADD CONSTRAINT "landing_pages_about_transparency_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_about_hero_image_id_platform_content_media_id_fk" FOREIGN KEY ("about_hero_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;

  CREATE INDEX "landing_pages_about_why_items_order_idx" ON "landing_pages_about_why_items" USING btree ("_order");
  CREATE INDEX "landing_pages_about_why_items_parent_id_idx" ON "landing_pages_about_why_items" USING btree ("_parent_id");
  CREATE INDEX "landing_pages_about_team_order_idx" ON "landing_pages_about_team" USING btree ("_order");
  CREATE INDEX "landing_pages_about_team_parent_id_idx" ON "landing_pages_about_team" USING btree ("_parent_id");
  CREATE INDEX "landing_pages_about_team_image_idx" ON "landing_pages_about_team" USING btree ("image_id");
  CREATE INDEX "landing_pages_about_transparency_items_order_idx" ON "landing_pages_about_transparency_items" USING btree ("_order");
  CREATE INDEX "landing_pages_about_transparency_items_parent_id_idx" ON "landing_pages_about_transparency_items" USING btree ("_parent_id");
  CREATE INDEX "landing_pages_about_hero_about_hero_image_idx" ON "landing_pages" USING btree ("about_hero_image_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "landing_pages_about_why_items" CASCADE;
  DROP TABLE "landing_pages_about_team" CASCADE;
  DROP TABLE "landing_pages_about_transparency_items" CASCADE;
  DROP INDEX "landing_pages_about_hero_about_hero_image_idx";
  ALTER TABLE "landing_pages" DROP CONSTRAINT "landing_pages_about_hero_image_id_platform_content_media_id_fk";
  ALTER TABLE "landing_pages" DROP COLUMN "about_seo_title";
  ALTER TABLE "landing_pages" DROP COLUMN "about_seo_description";
  ALTER TABLE "landing_pages" DROP COLUMN "about_hero_title";
  ALTER TABLE "landing_pages" DROP COLUMN "about_hero_description";
  ALTER TABLE "landing_pages" DROP COLUMN "about_hero_image_id";
  ALTER TABLE "landing_pages" DROP COLUMN "about_why_title";
  ALTER TABLE "landing_pages" DROP COLUMN "about_transparency_title";
  `)
}
