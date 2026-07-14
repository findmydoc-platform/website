import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "clinic_media_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"platform_staff_id" integer,
  	"clinic_staff_id" integer
  );
  
  CREATE TABLE "clinic_gallery_media_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"platform_staff_id" integer,
  	"clinic_staff_id" integer
  );
  
  CREATE TABLE "clinic_gallery_entries_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"platform_staff_id" integer,
  	"clinic_staff_id" integer
  );
  
  CREATE TABLE "doctor_media_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"platform_staff_id" integer,
  	"clinic_staff_id" integer
  );
  
  ALTER TABLE "posts_rels" ADD COLUMN "platform_staff_id" integer;
  ALTER TABLE "_posts_v_rels" ADD COLUMN "platform_staff_id" integer;
  ALTER TABLE "payload_preferences_rels" RENAME COLUMN "basic_users_id" TO "legacy_basic_users_id";
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "platform_staff_id" integer;
  ALTER TABLE "posts_rels" DROP CONSTRAINT "posts_rels_basic_users_fk";
  
  ALTER TABLE "_posts_v_rels" DROP CONSTRAINT "_posts_v_rels_basic_users_fk";
  
  ALTER TABLE "platform_content_media" DROP CONSTRAINT "platform_content_media_created_by_id_basic_users_id_fk";
  
  ALTER TABLE "clinic_media" DROP CONSTRAINT "clinic_media_created_by_id_basic_users_id_fk";
  
  ALTER TABLE "clinic_gallery_media" DROP CONSTRAINT "clinic_gallery_media_created_by_id_basic_users_id_fk";
  
  ALTER TABLE "clinic_gallery_entries" DROP CONSTRAINT "clinic_gallery_entries_created_by_id_basic_users_id_fk";
  
  ALTER TABLE "doctor_media" DROP CONSTRAINT "doctor_media_created_by_id_basic_users_id_fk";
  
  ALTER TABLE "user_profile_media_rels" DROP CONSTRAINT "user_profile_media_rels_basic_users_fk";
  
  ALTER TABLE "clinic_staff" DROP CONSTRAINT "clinic_staff_user_id_basic_users_id_fk";
  
  ALTER TABLE "platform_staff" DROP CONSTRAINT "platform_staff_user_id_basic_users_id_fk";
  
  ALTER TABLE "clinic_staff" ALTER COLUMN "user_id" DROP NOT NULL;
  
  ALTER TABLE "platform_staff" ALTER COLUMN "user_id" DROP NOT NULL;
  
  ALTER TABLE "clinic_applications" DROP CONSTRAINT "clinic_applications_linked_records_basic_user_id_basic_users_id_fk";
  
  ALTER TABLE "patient_clinic_inquiries" DROP CONSTRAINT "patient_clinic_inquiries_assigned_to_id_basic_users_id_fk";
  
  ALTER TABLE "reviews" DROP CONSTRAINT "reviews_edited_by_id_basic_users_id_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_basic_users_fk";
  
  DROP INDEX "clinic_media_created_by_idx";
  DROP INDEX "clinic_gallery_media_created_by_idx";
  DROP INDEX "clinic_gallery_entries_created_by_idx";
  DROP INDEX "doctor_media_created_by_idx";
  DROP INDEX "user_profile_media_rels_basic_users_id_idx";
  DROP INDEX "clinic_staff_user_idx";
  DROP INDEX "platform_staff_user_idx";
  DROP INDEX "clinic_applications_linked_records_linked_records_basic__idx";
  DROP INDEX "payload_preferences_rels_basic_users_id_idx";
  ALTER TABLE "platform_content_media" RENAME COLUMN "created_by_id" TO "legacy_created_by_id";
  ALTER TABLE "platform_content_media" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "patient_clinic_inquiries" RENAME COLUMN "assigned_to_id" TO "legacy_assigned_to_id";
  ALTER TABLE "patient_clinic_inquiries" ADD COLUMN "assigned_to_id" integer;
  ALTER TABLE "reviews" RENAME COLUMN "edited_by_id" TO "legacy_edited_by_id";
  ALTER TABLE "reviews" ADD COLUMN "edited_by_id" integer;
  ALTER TABLE "user_profile_media_rels" ADD COLUMN "platform_staff_id" integer;
  ALTER TABLE "user_profile_media_rels" ADD COLUMN "clinic_staff_id" integer;

  DO $migration$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM "posts_rels" AS relation
      LEFT JOIN "platform_staff" AS principal ON principal."user_id" = relation."basic_users_id"
      WHERE relation."basic_users_id" IS NOT NULL AND principal."id" IS NULL
    ) THEN
      RAISE EXCEPTION 'Direct staff auth switch aborted: a post author cannot be mapped to PlatformStaff';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "_posts_v_rels" AS relation
      LEFT JOIN "platform_staff" AS principal ON principal."user_id" = relation."basic_users_id"
      WHERE relation."basic_users_id" IS NOT NULL AND principal."id" IS NULL
    ) THEN
      RAISE EXCEPTION 'Direct staff auth switch aborted: a draft post author cannot be mapped to PlatformStaff';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM (
        SELECT "created_by_id" AS "basic_user_id" FROM "platform_content_media" WHERE "created_by_id" IS NOT NULL
        UNION ALL
        SELECT "assigned_to_id" FROM "patient_clinic_inquiries" WHERE "assigned_to_id" IS NOT NULL
        UNION ALL
        SELECT "edited_by_id" FROM "reviews" WHERE "edited_by_id" IS NOT NULL
      ) AS reference
      LEFT JOIN "platform_staff" AS principal ON principal."user_id" = reference."basic_user_id"
      WHERE principal."id" IS NULL
    ) THEN
      RAISE EXCEPTION 'Direct staff auth switch aborted: a platform-only relationship cannot be mapped to PlatformStaff';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM (
        SELECT "created_by_id" AS "basic_user_id" FROM "clinic_media" WHERE "created_by_id" IS NOT NULL
        UNION ALL
        SELECT "created_by_id" FROM "clinic_gallery_media" WHERE "created_by_id" IS NOT NULL
        UNION ALL
        SELECT "created_by_id" FROM "clinic_gallery_entries" WHERE "created_by_id" IS NOT NULL
        UNION ALL
        SELECT "created_by_id" FROM "doctor_media" WHERE "created_by_id" IS NOT NULL
        UNION ALL
        SELECT "basic_users_id" FROM "user_profile_media_rels" WHERE "basic_users_id" IS NOT NULL
        UNION ALL
        SELECT "legacy_basic_users_id" FROM "payload_preferences_rels" WHERE "legacy_basic_users_id" IS NOT NULL
      ) AS reference
      LEFT JOIN "platform_staff" AS platform_principal ON platform_principal."user_id" = reference."basic_user_id"
      LEFT JOIN "clinic_staff" AS clinic_principal ON clinic_principal."user_id" = reference."basic_user_id"
      WHERE (platform_principal."id" IS NULL AND clinic_principal."id" IS NULL)
         OR (platform_principal."id" IS NOT NULL AND clinic_principal."id" IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'Direct staff auth switch aborted: a polymorphic staff relationship cannot be mapped exactly once';
    END IF;
  END
  $migration$;

  UPDATE "posts_rels" AS relation
  SET "platform_staff_id" = principal."id"
  FROM "platform_staff" AS principal
  WHERE principal."user_id" = relation."basic_users_id";

  UPDATE "_posts_v_rels" AS relation
  SET "platform_staff_id" = principal."id"
  FROM "platform_staff" AS principal
  WHERE principal."user_id" = relation."basic_users_id";

  INSERT INTO "clinic_media_rels" ("parent_id", "path", "platform_staff_id")
  SELECT media."id", 'createdBy', principal."id"
  FROM "clinic_media" AS media
  JOIN "platform_staff" AS principal ON principal."user_id" = media."created_by_id"
  WHERE media."created_by_id" IS NOT NULL;

  INSERT INTO "clinic_media_rels" ("parent_id", "path", "clinic_staff_id")
  SELECT media."id", 'createdBy', principal."id"
  FROM "clinic_media" AS media
  JOIN "clinic_staff" AS principal ON principal."user_id" = media."created_by_id"
  WHERE media."created_by_id" IS NOT NULL;

  INSERT INTO "clinic_gallery_media_rels" ("parent_id", "path", "platform_staff_id")
  SELECT media."id", 'createdBy', principal."id"
  FROM "clinic_gallery_media" AS media
  JOIN "platform_staff" AS principal ON principal."user_id" = media."created_by_id"
  WHERE media."created_by_id" IS NOT NULL;

  INSERT INTO "clinic_gallery_media_rels" ("parent_id", "path", "clinic_staff_id")
  SELECT media."id", 'createdBy', principal."id"
  FROM "clinic_gallery_media" AS media
  JOIN "clinic_staff" AS principal ON principal."user_id" = media."created_by_id"
  WHERE media."created_by_id" IS NOT NULL;

  INSERT INTO "clinic_gallery_entries_rels" ("parent_id", "path", "platform_staff_id")
  SELECT entry."id", 'createdBy', principal."id"
  FROM "clinic_gallery_entries" AS entry
  JOIN "platform_staff" AS principal ON principal."user_id" = entry."created_by_id"
  WHERE entry."created_by_id" IS NOT NULL;

  INSERT INTO "clinic_gallery_entries_rels" ("parent_id", "path", "clinic_staff_id")
  SELECT entry."id", 'createdBy', principal."id"
  FROM "clinic_gallery_entries" AS entry
  JOIN "clinic_staff" AS principal ON principal."user_id" = entry."created_by_id"
  WHERE entry."created_by_id" IS NOT NULL;

  INSERT INTO "doctor_media_rels" ("parent_id", "path", "platform_staff_id")
  SELECT media."id", 'createdBy', principal."id"
  FROM "doctor_media" AS media
  JOIN "platform_staff" AS principal ON principal."user_id" = media."created_by_id"
  WHERE media."created_by_id" IS NOT NULL;

  INSERT INTO "doctor_media_rels" ("parent_id", "path", "clinic_staff_id")
  SELECT media."id", 'createdBy', principal."id"
  FROM "doctor_media" AS media
  JOIN "clinic_staff" AS principal ON principal."user_id" = media."created_by_id"
  WHERE media."created_by_id" IS NOT NULL;

  UPDATE "user_profile_media_rels" AS relation
  SET "platform_staff_id" = principal."id"
  FROM "platform_staff" AS principal
  WHERE principal."user_id" = relation."basic_users_id";

  UPDATE "user_profile_media_rels" AS relation
  SET "clinic_staff_id" = principal."id"
  FROM "clinic_staff" AS principal
  WHERE principal."user_id" = relation."basic_users_id";

  UPDATE "platform_content_media" AS media
  SET "created_by_id" = principal."id"
  FROM "platform_staff" AS principal
  WHERE principal."user_id" = media."legacy_created_by_id";

  UPDATE "patient_clinic_inquiries" AS inquiry
  SET "assigned_to_id" = principal."id"
  FROM "platform_staff" AS principal
  WHERE principal."user_id" = inquiry."legacy_assigned_to_id";

  UPDATE "reviews" AS review
  SET "edited_by_id" = principal."id"
  FROM "platform_staff" AS principal
  WHERE principal."user_id" = review."legacy_edited_by_id";

  UPDATE "payload_preferences_rels" AS relation
  SET "platform_staff_id" = principal."id"
  FROM "platform_staff" AS principal
  WHERE principal."user_id" = relation."legacy_basic_users_id";
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "clinic_staff_id" integer;

  UPDATE "payload_preferences_rels" AS relation
  SET "clinic_staff_id" = principal."id"
  FROM "clinic_staff" AS principal
  WHERE principal."user_id" = relation."legacy_basic_users_id";
  ALTER TABLE "clinic_media_rels" ADD CONSTRAINT "clinic_media_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."clinic_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clinic_media_rels" ADD CONSTRAINT "clinic_media_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clinic_media_rels" ADD CONSTRAINT "clinic_media_rels_clinic_staff_fk" FOREIGN KEY ("clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clinic_gallery_media_rels" ADD CONSTRAINT "clinic_gallery_media_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."clinic_gallery_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clinic_gallery_media_rels" ADD CONSTRAINT "clinic_gallery_media_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clinic_gallery_media_rels" ADD CONSTRAINT "clinic_gallery_media_rels_clinic_staff_fk" FOREIGN KEY ("clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clinic_gallery_entries_rels" ADD CONSTRAINT "clinic_gallery_entries_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."clinic_gallery_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clinic_gallery_entries_rels" ADD CONSTRAINT "clinic_gallery_entries_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clinic_gallery_entries_rels" ADD CONSTRAINT "clinic_gallery_entries_rels_clinic_staff_fk" FOREIGN KEY ("clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "doctor_media_rels" ADD CONSTRAINT "doctor_media_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."doctor_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "doctor_media_rels" ADD CONSTRAINT "doctor_media_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "doctor_media_rels" ADD CONSTRAINT "doctor_media_rels_clinic_staff_fk" FOREIGN KEY ("clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "clinic_media_rels_order_idx" ON "clinic_media_rels" USING btree ("order");
  CREATE INDEX "clinic_media_rels_parent_idx" ON "clinic_media_rels" USING btree ("parent_id");
  CREATE INDEX "clinic_media_rels_path_idx" ON "clinic_media_rels" USING btree ("path");
  CREATE INDEX "clinic_media_rels_platform_staff_id_idx" ON "clinic_media_rels" USING btree ("platform_staff_id");
  CREATE INDEX "clinic_media_rels_clinic_staff_id_idx" ON "clinic_media_rels" USING btree ("clinic_staff_id");
  CREATE INDEX "clinic_gallery_media_rels_order_idx" ON "clinic_gallery_media_rels" USING btree ("order");
  CREATE INDEX "clinic_gallery_media_rels_parent_idx" ON "clinic_gallery_media_rels" USING btree ("parent_id");
  CREATE INDEX "clinic_gallery_media_rels_path_idx" ON "clinic_gallery_media_rels" USING btree ("path");
  CREATE INDEX "clinic_gallery_media_rels_platform_staff_id_idx" ON "clinic_gallery_media_rels" USING btree ("platform_staff_id");
  CREATE INDEX "clinic_gallery_media_rels_clinic_staff_id_idx" ON "clinic_gallery_media_rels" USING btree ("clinic_staff_id");
  CREATE INDEX "clinic_gallery_entries_rels_order_idx" ON "clinic_gallery_entries_rels" USING btree ("order");
  CREATE INDEX "clinic_gallery_entries_rels_parent_idx" ON "clinic_gallery_entries_rels" USING btree ("parent_id");
  CREATE INDEX "clinic_gallery_entries_rels_path_idx" ON "clinic_gallery_entries_rels" USING btree ("path");
  CREATE INDEX "clinic_gallery_entries_rels_platform_staff_id_idx" ON "clinic_gallery_entries_rels" USING btree ("platform_staff_id");
  CREATE INDEX "clinic_gallery_entries_rels_clinic_staff_id_idx" ON "clinic_gallery_entries_rels" USING btree ("clinic_staff_id");
  CREATE INDEX "doctor_media_rels_order_idx" ON "doctor_media_rels" USING btree ("order");
  CREATE INDEX "doctor_media_rels_parent_idx" ON "doctor_media_rels" USING btree ("parent_id");
  CREATE INDEX "doctor_media_rels_path_idx" ON "doctor_media_rels" USING btree ("path");
  CREATE INDEX "doctor_media_rels_platform_staff_id_idx" ON "doctor_media_rels" USING btree ("platform_staff_id");
  CREATE INDEX "doctor_media_rels_clinic_staff_id_idx" ON "doctor_media_rels" USING btree ("clinic_staff_id");
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "platform_content_media" ADD CONSTRAINT "platform_content_media_created_by_id_platform_staff_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."platform_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_profile_media_rels" ADD CONSTRAINT "user_profile_media_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_profile_media_rels" ADD CONSTRAINT "user_profile_media_rels_clinic_staff_fk" FOREIGN KEY ("clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "patient_clinic_inquiries" ADD CONSTRAINT "patient_clinic_inquiries_assigned_to_id_platform_staff_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."platform_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_edited_by_id_platform_staff_id_fk" FOREIGN KEY ("edited_by_id") REFERENCES "public"."platform_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_clinic_staff_fk" FOREIGN KEY ("clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_rels_platform_staff_id_idx" ON "posts_rels" USING btree ("platform_staff_id");
  CREATE INDEX "_posts_v_rels_platform_staff_id_idx" ON "_posts_v_rels" USING btree ("platform_staff_id");
  CREATE INDEX "user_profile_media_rels_platform_staff_id_idx" ON "user_profile_media_rels" USING btree ("platform_staff_id");
  CREATE INDEX "user_profile_media_rels_clinic_staff_id_idx" ON "user_profile_media_rels" USING btree ("clinic_staff_id");
  CREATE INDEX "payload_preferences_rels_clinic_staff_id_idx" ON "payload_preferences_rels" USING btree ("clinic_staff_id");
  CREATE INDEX "payload_preferences_rels_platform_staff_id_idx" ON "payload_preferences_rels" USING btree ("platform_staff_id");
  -- Legacy source columns remain physically intact until the contract migration.
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "posts_rels" DROP CONSTRAINT "posts_rels_platform_staff_fk";
    ALTER TABLE "_posts_v_rels" DROP CONSTRAINT "_posts_v_rels_platform_staff_fk";
    ALTER TABLE "platform_content_media" DROP CONSTRAINT "platform_content_media_created_by_id_platform_staff_id_fk";
    ALTER TABLE "user_profile_media_rels" DROP CONSTRAINT "user_profile_media_rels_platform_staff_fk";
    ALTER TABLE "user_profile_media_rels" DROP CONSTRAINT "user_profile_media_rels_clinic_staff_fk";
    ALTER TABLE "patient_clinic_inquiries" DROP CONSTRAINT "patient_clinic_inquiries_assigned_to_id_platform_staff_id_fk";
    ALTER TABLE "reviews" DROP CONSTRAINT "reviews_edited_by_id_platform_staff_id_fk";
    ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_clinic_staff_fk";
    ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_platform_staff_fk";

    DROP INDEX "posts_rels_platform_staff_id_idx";
    DROP INDEX "_posts_v_rels_platform_staff_id_idx";
    DROP INDEX "user_profile_media_rels_platform_staff_id_idx";
    DROP INDEX "user_profile_media_rels_clinic_staff_id_idx";
    DROP INDEX "payload_preferences_rels_clinic_staff_id_idx";
    DROP INDEX "payload_preferences_rels_platform_staff_id_idx";

    ALTER TABLE "platform_content_media" DROP COLUMN "created_by_id";
    ALTER TABLE "platform_content_media" RENAME COLUMN "legacy_created_by_id" TO "created_by_id";
    ALTER TABLE "patient_clinic_inquiries" DROP COLUMN "assigned_to_id";
    ALTER TABLE "patient_clinic_inquiries" RENAME COLUMN "legacy_assigned_to_id" TO "assigned_to_id";
    ALTER TABLE "reviews" DROP COLUMN "edited_by_id";
    ALTER TABLE "reviews" RENAME COLUMN "legacy_edited_by_id" TO "edited_by_id";
    ALTER TABLE "posts_rels" DROP COLUMN "platform_staff_id";
    ALTER TABLE "_posts_v_rels" DROP COLUMN "platform_staff_id";
    ALTER TABLE "user_profile_media_rels" DROP COLUMN "platform_staff_id";
    ALTER TABLE "user_profile_media_rels" DROP COLUMN "clinic_staff_id";
    ALTER TABLE "payload_preferences_rels" DROP COLUMN "clinic_staff_id";
    ALTER TABLE "payload_preferences_rels" DROP COLUMN "platform_staff_id";
    ALTER TABLE "payload_preferences_rels" RENAME COLUMN "legacy_basic_users_id" TO "basic_users_id";

    DROP TABLE "clinic_media_rels" CASCADE;
    DROP TABLE "clinic_gallery_media_rels" CASCADE;
    DROP TABLE "clinic_gallery_entries_rels" CASCADE;
    DROP TABLE "doctor_media_rels" CASCADE;

    ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_basic_users_fk" FOREIGN KEY ("basic_users_id") REFERENCES "public"."basic_users"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_basic_users_fk" FOREIGN KEY ("basic_users_id") REFERENCES "public"."basic_users"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "platform_content_media" ADD CONSTRAINT "platform_content_media_created_by_id_basic_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "clinic_media" ADD CONSTRAINT "clinic_media_created_by_id_basic_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "clinic_gallery_media" ADD CONSTRAINT "clinic_gallery_media_created_by_id_basic_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "clinic_gallery_entries" ADD CONSTRAINT "clinic_gallery_entries_created_by_id_basic_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "doctor_media" ADD CONSTRAINT "doctor_media_created_by_id_basic_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "user_profile_media_rels" ADD CONSTRAINT "user_profile_media_rels_basic_users_fk" FOREIGN KEY ("basic_users_id") REFERENCES "public"."basic_users"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "clinic_staff" ADD CONSTRAINT "clinic_staff_user_id_basic_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "platform_staff" ADD CONSTRAINT "platform_staff_user_id_basic_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "clinic_staff" ALTER COLUMN "user_id" SET NOT NULL;
    ALTER TABLE "platform_staff" ALTER COLUMN "user_id" SET NOT NULL;
    ALTER TABLE "clinic_applications" ADD CONSTRAINT "clinic_applications_linked_records_basic_user_id_basic_users_id_fk" FOREIGN KEY ("linked_records_basic_user_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "patient_clinic_inquiries" ADD CONSTRAINT "patient_clinic_inquiries_assigned_to_id_basic_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "reviews" ADD CONSTRAINT "reviews_edited_by_id_basic_users_id_fk" FOREIGN KEY ("edited_by_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_basic_users_fk" FOREIGN KEY ("basic_users_id") REFERENCES "public"."basic_users"("id") ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "clinic_media_created_by_idx" ON "clinic_media" USING btree ("created_by_id");
    CREATE INDEX "clinic_gallery_media_created_by_idx" ON "clinic_gallery_media" USING btree ("created_by_id");
    CREATE INDEX "clinic_gallery_entries_created_by_idx" ON "clinic_gallery_entries" USING btree ("created_by_id");
    CREATE INDEX "doctor_media_created_by_idx" ON "doctor_media" USING btree ("created_by_id");
    CREATE INDEX "user_profile_media_rels_basic_users_id_idx" ON "user_profile_media_rels" USING btree ("basic_users_id");
    CREATE UNIQUE INDEX "clinic_staff_user_idx" ON "clinic_staff" USING btree ("user_id");
    CREATE UNIQUE INDEX "platform_staff_user_idx" ON "platform_staff" USING btree ("user_id");
    CREATE INDEX "clinic_applications_linked_records_linked_records_basic__idx" ON "clinic_applications" USING btree ("linked_records_basic_user_id");
    CREATE INDEX "payload_preferences_rels_basic_users_id_idx" ON "payload_preferences_rels" USING btree ("basic_users_id");
  `)
}
