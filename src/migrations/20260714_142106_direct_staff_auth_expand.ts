import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_staff" ADD COLUMN "stable_id" varchar;
  ALTER TABLE "clinic_staff" ADD COLUMN "supabase_user_id" varchar;
  ALTER TABLE "clinic_staff" ADD COLUMN "email" varchar;
  ALTER TABLE "clinic_staff" ADD COLUMN "first_name" varchar;
  ALTER TABLE "clinic_staff" ADD COLUMN "last_name" varchar;
  ALTER TABLE "clinic_staff" ADD COLUMN "profile_image_id" integer;
  ALTER TABLE "platform_staff" ADD COLUMN "supabase_user_id" varchar;
  ALTER TABLE "platform_staff" ADD COLUMN "email" varchar;
  ALTER TABLE "platform_staff" ADD COLUMN "first_name" varchar;
  ALTER TABLE "platform_staff" ADD COLUMN "last_name" varchar;
  ALTER TABLE "platform_staff" ADD COLUMN "profile_image_id" integer;
  ALTER TABLE "clinic_staff" ADD CONSTRAINT "clinic_staff_profile_image_id_user_profile_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."user_profile_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "platform_staff" ADD CONSTRAINT "platform_staff_profile_image_id_user_profile_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."user_profile_media"("id") ON DELETE set null ON UPDATE no action;`)

  await db.execute(sql`
  DO $migration$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM "basic_users"
      WHERE "user_type" IS NULL OR "user_type" NOT IN ('clinic', 'platform')
    ) THEN
      RAISE EXCEPTION 'Direct staff auth expand aborted: a BasicUser has an unsupported user type';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "basic_users" AS basic_user
      LEFT JOIN "platform_staff" AS platform_profile ON platform_profile."user_id" = basic_user."id"
      WHERE basic_user."user_type" = 'platform' AND platform_profile."id" IS NULL
    ) THEN
      RAISE EXCEPTION 'Direct staff auth expand aborted: a platform BasicUser has no PlatformStaff profile';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "basic_users" AS basic_user
      LEFT JOIN "clinic_staff" AS clinic_profile ON clinic_profile."user_id" = basic_user."id"
      WHERE basic_user."user_type" = 'clinic' AND clinic_profile."id" IS NULL
    ) THEN
      RAISE EXCEPTION 'Direct staff auth expand aborted: a clinic BasicUser has no ClinicStaff profile';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "platform_staff" AS platform_profile
      JOIN "basic_users" AS basic_user ON basic_user."id" = platform_profile."user_id"
      WHERE basic_user."user_type" <> 'platform'
    ) THEN
      RAISE EXCEPTION 'Direct staff auth expand aborted: a PlatformStaff profile points to a non-platform BasicUser';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "clinic_staff" AS clinic_profile
      JOIN "basic_users" AS basic_user ON basic_user."id" = clinic_profile."user_id"
      WHERE basic_user."user_type" <> 'clinic'
    ) THEN
      RAISE EXCEPTION 'Direct staff auth expand aborted: a ClinicStaff profile points to a non-clinic BasicUser';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "platform_staff"
      WHERE "user_id" IS NULL
    ) THEN
      RAISE EXCEPTION 'Direct staff auth expand aborted: a PlatformStaff profile has no BasicUser';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "clinic_staff"
      WHERE "user_id" IS NULL
    ) THEN
      RAISE EXCEPTION 'Direct staff auth expand aborted: a ClinicStaff profile has no BasicUser';
    END IF;

    IF EXISTS (
      SELECT actor."user_id"
      FROM (
        SELECT "user_id" FROM "platform_staff"
        UNION ALL
        SELECT "user_id" FROM "clinic_staff"
      ) AS actor
      GROUP BY actor."user_id"
      HAVING count(*) <> 1
    ) THEN
      RAISE EXCEPTION 'Direct staff auth expand aborted: a BasicUser is linked to multiple staff profiles';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "platform_staff"
      WHERE "stable_id" IS NULL OR btrim("stable_id") = ''
    ) THEN
      RAISE EXCEPTION 'Direct staff auth expand aborted: a PlatformStaff profile has no stable ID';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "clinic_staff" AS clinic_profile
      JOIN "basic_users" AS basic_user ON basic_user."id" = clinic_profile."user_id"
      WHERE basic_user."stable_id" IS NULL OR btrim(basic_user."stable_id") = ''
    ) THEN
      RAISE EXCEPTION 'Direct staff auth expand aborted: a ClinicStaff source account has no stable ID';
    END IF;
  END
  $migration$;

  UPDATE "platform_staff" AS platform_profile
  SET
    "supabase_user_id" = NULLIF(btrim(basic_user."supabase_user_id"), ''),
    "email" = basic_user."email",
    "first_name" = basic_user."first_name",
    "last_name" = basic_user."last_name",
    "profile_image_id" = basic_user."profile_image_id"
  FROM "basic_users" AS basic_user
  WHERE basic_user."id" = platform_profile."user_id";

  UPDATE "clinic_staff" AS clinic_profile
  SET
    "stable_id" = basic_user."stable_id",
    "supabase_user_id" = NULLIF(btrim(basic_user."supabase_user_id"), ''),
    "email" = basic_user."email",
    "first_name" = basic_user."first_name",
    "last_name" = basic_user."last_name",
    "profile_image_id" = basic_user."profile_image_id"
  FROM "basic_users" AS basic_user
  WHERE basic_user."id" = clinic_profile."user_id";

  DO $migration$
  BEGIN
    IF EXISTS (
      SELECT principal."supabase_user_id"
      FROM (
        SELECT "supabase_user_id" FROM "platform_staff"
        UNION ALL
        SELECT "supabase_user_id" FROM "clinic_staff"
        UNION ALL
        SELECT "supabase_user_id" FROM "patients"
      ) AS principal
      WHERE principal."supabase_user_id" IS NOT NULL AND btrim(principal."supabase_user_id") <> ''
      GROUP BY principal."supabase_user_id"
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'Direct staff auth expand aborted: a Supabase identity occurs in multiple principal collections';
    END IF;
  END
  $migration$;

  CREATE UNIQUE INDEX "clinic_staff_stable_id_idx" ON "clinic_staff" USING btree ("stable_id");
  CREATE UNIQUE INDEX "clinic_staff_supabase_user_id_idx" ON "clinic_staff" USING btree ("supabase_user_id");
  CREATE INDEX "clinic_staff_profile_image_idx" ON "clinic_staff" USING btree ("profile_image_id");
  CREATE UNIQUE INDEX "platform_staff_supabase_user_id_idx" ON "platform_staff" USING btree ("supabase_user_id");
  CREATE INDEX "platform_staff_profile_image_idx" ON "platform_staff" USING btree ("profile_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_staff" DROP CONSTRAINT "clinic_staff_profile_image_id_user_profile_media_id_fk";
  
  ALTER TABLE "platform_staff" DROP CONSTRAINT "platform_staff_profile_image_id_user_profile_media_id_fk";
  
  DROP INDEX "clinic_staff_stable_id_idx";
  DROP INDEX "clinic_staff_supabase_user_id_idx";
  DROP INDEX "clinic_staff_profile_image_idx";
  DROP INDEX "platform_staff_supabase_user_id_idx";
  DROP INDEX "platform_staff_profile_image_idx";
  ALTER TABLE "clinic_staff" DROP COLUMN "stable_id";
  ALTER TABLE "clinic_staff" DROP COLUMN "supabase_user_id";
  ALTER TABLE "clinic_staff" DROP COLUMN "email";
  ALTER TABLE "clinic_staff" DROP COLUMN "first_name";
  ALTER TABLE "clinic_staff" DROP COLUMN "last_name";
  ALTER TABLE "clinic_staff" DROP COLUMN "profile_image_id";
  ALTER TABLE "platform_staff" DROP COLUMN "supabase_user_id";
  ALTER TABLE "platform_staff" DROP COLUMN "email";
  ALTER TABLE "platform_staff" DROP COLUMN "first_name";
  ALTER TABLE "platform_staff" DROP COLUMN "last_name";
  ALTER TABLE "platform_staff" DROP COLUMN "profile_image_id";`)
}
