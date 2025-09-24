import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" RENAME TO "platform_content_media";
   ALTER SEQUENCE IF EXISTS "media_id_seq" RENAME TO "platform_content_media_id_seq";
   ALTER TABLE "platform_content_media" ALTER COLUMN "id" SET DEFAULT nextval('platform_content_media_id_seq');

   ALTER INDEX "media_updated_at_idx" RENAME TO "platform_content_media_updated_at_idx";
   ALTER INDEX "media_created_at_idx" RENAME TO "platform_content_media_created_at_idx";
   ALTER INDEX "media_deleted_at_idx" RENAME TO "platform_content_media_deleted_at_idx";
   ALTER INDEX "media_filename_idx" RENAME TO "platform_content_media_filename_idx";
   ALTER INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" RENAME TO "platform_content_media_sizes_thumbnail_sizes_thumbnail_filename_idx";
   ALTER INDEX "media_sizes_square_sizes_square_filename_idx" RENAME TO "platform_content_media_sizes_square_sizes_square_filename_idx";
   ALTER INDEX "media_sizes_small_sizes_small_filename_idx" RENAME TO "platform_content_media_sizes_small_sizes_small_filename_idx";
   ALTER INDEX "media_sizes_medium_sizes_medium_filename_idx" RENAME TO "platform_content_media_sizes_medium_sizes_medium_filename_idx";
   ALTER INDEX "media_sizes_large_sizes_large_filename_idx" RENAME TO "platform_content_media_sizes_large_sizes_large_filename_idx";
   ALTER INDEX "media_sizes_xlarge_sizes_xlarge_filename_idx" RENAME TO "platform_content_media_sizes_xlarge_sizes_xlarge_filename_idx";
   ALTER INDEX "media_sizes_og_sizes_og_filename_idx" RENAME TO "platform_content_media_sizes_og_sizes_og_filename_idx";

   ALTER TABLE "platform_content_media" RENAME COLUMN "prefix" TO "storage_path";
   ALTER TABLE "platform_content_media" ALTER COLUMN "caption" TYPE varchar USING caption::text;
   UPDATE "platform_content_media"
     SET "storage_path" = CASE
       WHEN storage_path IS NULL OR storage_path = '' THEN
         'platform/' || id::text || '/' || COALESCE(NULLIF(filename, ''), id::text || '.bin')
       ELSE storage_path
     END;
   UPDATE "platform_content_media" SET "alt" = COALESCE(NULLIF(btrim(alt), ''), 'Placeholder alt text');
   ALTER TABLE "platform_content_media" ALTER COLUMN "storage_path" SET NOT NULL;
   ALTER TABLE "platform_content_media" ALTER COLUMN "alt" SET NOT NULL;

   ALTER TABLE "platform_content_media" ADD COLUMN "created_by_id" integer;
   DO $$
   DECLARE default_user integer;
   BEGIN
     SELECT id INTO default_user FROM "basic_users" ORDER BY id ASC LIMIT 1;
     IF default_user IS NOT NULL THEN
       UPDATE "platform_content_media"
         SET "created_by_id" = default_user
         WHERE "created_by_id" IS NULL;
     END IF;
     IF EXISTS (SELECT 1 FROM "platform_content_media" WHERE "created_by_id" IS NULL) THEN
       RAISE EXCEPTION 'Unable to assign created_by_id for existing platform media records';
     END IF;
   END
   $$;
   ALTER TABLE "platform_content_media" ALTER COLUMN "created_by_id" SET NOT NULL;
   ALTER TABLE "platform_content_media" ADD CONSTRAINT "platform_content_media_created_by_id_basic_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
   CREATE INDEX "platform_content_media_created_by_idx" ON "platform_content_media" USING btree ("created_by_id");

   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_media_fk";
   DROP INDEX "payload_locked_documents_rels_media_id_idx";
   ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "media_id" TO "platform_content_media_id";
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_platform_content_media_fk" FOREIGN KEY ("platform_content_media_id") REFERENCES "public"."platform_content_media"("id") ON DELETE cascade ON UPDATE no action;
   CREATE INDEX "payload_locked_documents_rels_platform_content_media_id_idx" ON "payload_locked_documents_rels" USING btree ("platform_content_media_id");

   ALTER TABLE "pages_blocks_benefits_block_cards" DROP CONSTRAINT "pages_blocks_benefits_block_cards_image_id_media_id_fk";
   ALTER TABLE "pages_blocks_content_columns" DROP CONSTRAINT "pages_blocks_content_columns_image_id_media_id_fk";
   ALTER TABLE "pages_blocks_media_block" DROP CONSTRAINT "pages_blocks_media_block_media_id_media_id_fk";
   ALTER TABLE "pages" DROP CONSTRAINT "pages_hero_media_id_media_id_fk";
   ALTER TABLE "pages" DROP CONSTRAINT "pages_meta_image_id_media_id_fk";
   ALTER TABLE "_pages_v_blocks_benefits_block_cards" DROP CONSTRAINT "_pages_v_blocks_benefits_block_cards_image_id_media_id_fk";
   ALTER TABLE "_pages_v_blocks_content_columns" DROP CONSTRAINT "_pages_v_blocks_content_columns_image_id_media_id_fk";
   ALTER TABLE "_pages_v_blocks_media_block" DROP CONSTRAINT "_pages_v_blocks_media_block_media_id_media_id_fk";
   ALTER TABLE "_pages_v" DROP CONSTRAINT "_pages_v_version_hero_media_id_media_id_fk";
   ALTER TABLE "_pages_v" DROP CONSTRAINT "_pages_v_version_meta_image_id_media_id_fk";
   ALTER TABLE "posts" DROP CONSTRAINT "posts_hero_image_id_media_id_fk";
   ALTER TABLE "posts" DROP CONSTRAINT "posts_meta_image_id_media_id_fk";
   ALTER TABLE "_posts_v" DROP CONSTRAINT "_posts_v_version_hero_image_id_media_id_fk";
   ALTER TABLE "_posts_v" DROP CONSTRAINT "_posts_v_version_meta_image_id_media_id_fk";
   ALTER TABLE "patients" DROP CONSTRAINT "patients_profile_image_id_media_id_fk";
   ALTER TABLE "basic_users" DROP CONSTRAINT "basic_users_profile_image_id_media_id_fk";
   ALTER TABLE "doctors" DROP CONSTRAINT "doctors_profile_image_id_media_id_fk";
   ALTER TABLE "accreditation" DROP CONSTRAINT "accreditation_icon_id_media_id_fk";
   ALTER TABLE "medical_specialties" DROP CONSTRAINT "medical_specialties_icon_id_media_id_fk";
   ALTER TABLE "search" DROP CONSTRAINT "search_meta_image_id_media_id_fk";

   CREATE TABLE "doctor_media" (
        "id" serial PRIMARY KEY NOT NULL,
        "alt" varchar NOT NULL,
        "caption" varchar,
        "doctor_id" integer NOT NULL,
        "clinic_id" integer NOT NULL,
        "created_by_id" integer NOT NULL,
        "storage_path" varchar NOT NULL,
        "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "deleted_at" timestamp(3) with time zone,
        "url" varchar,
        "thumbnail_u_r_l" varchar,
        "filename" varchar,
        "mime_type" varchar,
        "filesize" numeric,
        "width" numeric,
        "height" numeric,
        "focal_x" numeric,
        "focal_y" numeric,
        "sizes_thumbnail_url" varchar,
        "sizes_thumbnail_width" numeric,
        "sizes_thumbnail_height" numeric,
        "sizes_thumbnail_mime_type" varchar,
        "sizes_thumbnail_filesize" numeric,
        "sizes_thumbnail_filename" varchar,
        "sizes_square_url" varchar,
        "sizes_square_width" numeric,
        "sizes_square_height" numeric,
        "sizes_square_mime_type" varchar,
        "sizes_square_filesize" numeric,
        "sizes_square_filename" varchar,
        "sizes_small_url" varchar,
        "sizes_small_width" numeric,
        "sizes_small_height" numeric,
        "sizes_small_mime_type" varchar,
        "sizes_small_filesize" numeric,
        "sizes_small_filename" varchar,
        "sizes_medium_url" varchar,
        "sizes_medium_width" numeric,
        "sizes_medium_height" numeric,
        "sizes_medium_mime_type" varchar,
        "sizes_medium_filesize" numeric,
        "sizes_medium_filename" varchar,
        "sizes_large_url" varchar,
        "sizes_large_width" numeric,
        "sizes_large_height" numeric,
        "sizes_large_mime_type" varchar,
        "sizes_large_filesize" numeric,
        "sizes_large_filename" varchar,
        "sizes_xlarge_url" varchar,
        "sizes_xlarge_width" numeric,
        "sizes_xlarge_height" numeric,
        "sizes_xlarge_mime_type" varchar,
        "sizes_xlarge_filesize" numeric,
        "sizes_xlarge_filename" varchar,
        "sizes_og_url" varchar,
        "sizes_og_width" numeric,
        "sizes_og_height" numeric,
        "sizes_og_mime_type" varchar,
        "sizes_og_filesize" numeric,
        "sizes_og_filename" varchar
   );

   ALTER TABLE "doctor_media" ADD CONSTRAINT "doctor_media_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "doctor_media" ADD CONSTRAINT "doctor_media_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "doctor_media" ADD CONSTRAINT "doctor_media_created_by_id_basic_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;
   CREATE INDEX "doctor_media_doctor_idx" ON "doctor_media" USING btree ("doctor_id");
   CREATE INDEX "doctor_media_clinic_idx" ON "doctor_media" USING btree ("clinic_id");
   CREATE INDEX "doctor_media_created_by_idx" ON "doctor_media" USING btree ("created_by_id");
   CREATE INDEX "doctor_media_updated_at_idx" ON "doctor_media" USING btree ("updated_at");
   CREATE INDEX "doctor_media_created_at_idx" ON "doctor_media" USING btree ("created_at");
   CREATE INDEX "doctor_media_deleted_at_idx" ON "doctor_media" USING btree ("deleted_at");
   CREATE UNIQUE INDEX "doctor_media_filename_idx" ON "doctor_media" USING btree ("filename");
   CREATE INDEX "doctor_media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "doctor_media" USING btree ("sizes_thumbnail_filename");
   CREATE INDEX "doctor_media_sizes_square_sizes_square_filename_idx" ON "doctor_media" USING btree ("sizes_square_filename");
   CREATE INDEX "doctor_media_sizes_small_sizes_small_filename_idx" ON "doctor_media" USING btree ("sizes_small_filename");
   CREATE INDEX "doctor_media_sizes_medium_sizes_medium_filename_idx" ON "doctor_media" USING btree ("sizes_medium_filename");
   CREATE INDEX "doctor_media_sizes_large_sizes_large_filename_idx" ON "doctor_media" USING btree ("sizes_large_filename");
   CREATE INDEX "doctor_media_sizes_xlarge_sizes_xlarge_filename_idx" ON "doctor_media" USING btree ("sizes_xlarge_filename");
   CREATE INDEX "doctor_media_sizes_og_sizes_og_filename_idx" ON "doctor_media" USING btree ("sizes_og_filename");

   CREATE TABLE "user_profile_media" (
        "id" serial PRIMARY KEY NOT NULL,
        "alt" varchar NOT NULL,
        "caption" varchar,
        "storage_path" varchar NOT NULL,
        "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "deleted_at" timestamp(3) with time zone,
        "url" varchar,
        "thumbnail_u_r_l" varchar,
        "filename" varchar,
        "mime_type" varchar,
        "filesize" numeric,
        "width" numeric,
        "height" numeric,
        "focal_x" numeric,
        "focal_y" numeric,
        "sizes_thumbnail_url" varchar,
        "sizes_thumbnail_width" numeric,
        "sizes_thumbnail_height" numeric,
        "sizes_thumbnail_mime_type" varchar,
        "sizes_thumbnail_filesize" numeric,
        "sizes_thumbnail_filename" varchar,
        "sizes_square_url" varchar,
        "sizes_square_width" numeric,
        "sizes_square_height" numeric,
        "sizes_square_mime_type" varchar,
        "sizes_square_filesize" numeric,
        "sizes_square_filename" varchar,
        "sizes_small_url" varchar,
        "sizes_small_width" numeric,
        "sizes_small_height" numeric,
        "sizes_small_mime_type" varchar,
        "sizes_small_filesize" numeric,
        "sizes_small_filename" varchar,
        "sizes_medium_url" varchar,
        "sizes_medium_width" numeric,
        "sizes_medium_height" numeric,
        "sizes_medium_mime_type" varchar,
        "sizes_medium_filesize" numeric,
        "sizes_medium_filename" varchar,
        "sizes_large_url" varchar,
        "sizes_large_width" numeric,
        "sizes_large_height" numeric,
        "sizes_large_mime_type" varchar,
        "sizes_large_filesize" numeric,
        "sizes_large_filename" varchar,
        "sizes_xlarge_url" varchar,
        "sizes_xlarge_width" numeric,
        "sizes_xlarge_height" numeric,
        "sizes_xlarge_mime_type" varchar,
        "sizes_xlarge_filesize" numeric,
        "sizes_xlarge_filename" varchar,
        "sizes_og_url" varchar,
        "sizes_og_width" numeric,
        "sizes_og_height" numeric,
        "sizes_og_mime_type" varchar,
        "sizes_og_filesize" numeric,
        "sizes_og_filename" varchar
   );

   CREATE INDEX "user_profile_media_updated_at_idx" ON "user_profile_media" USING btree ("updated_at");
   CREATE INDEX "user_profile_media_created_at_idx" ON "user_profile_media" USING btree ("created_at");
   CREATE INDEX "user_profile_media_deleted_at_idx" ON "user_profile_media" USING btree ("deleted_at");
   CREATE UNIQUE INDEX "user_profile_media_filename_idx" ON "user_profile_media" USING btree ("filename");
   CREATE INDEX "user_profile_media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "user_profile_media" USING btree ("sizes_thumbnail_filename");
   CREATE INDEX "user_profile_media_sizes_square_sizes_square_filename_idx" ON "user_profile_media" USING btree ("sizes_square_filename");
   CREATE INDEX "user_profile_media_sizes_small_sizes_small_filename_idx" ON "user_profile_media" USING btree ("sizes_small_filename");
   CREATE INDEX "user_profile_media_sizes_medium_sizes_medium_filename_idx" ON "user_profile_media" USING btree ("sizes_medium_filename");
   CREATE INDEX "user_profile_media_sizes_large_sizes_large_filename_idx" ON "user_profile_media" USING btree ("sizes_large_filename");
   CREATE INDEX "user_profile_media_sizes_xlarge_sizes_xlarge_filename_idx" ON "user_profile_media" USING btree ("sizes_xlarge_filename");
   CREATE INDEX "user_profile_media_sizes_og_sizes_og_filename_idx" ON "user_profile_media" USING btree ("sizes_og_filename");

   CREATE TABLE "user_profile_media_user_rels" (
        "id" serial PRIMARY KEY NOT NULL,
        "order" integer,
        "parent_id" integer NOT NULL,
        "path" varchar NOT NULL,
        "basic_users_id" integer,
        "patients_id" integer
   );

   CREATE TABLE "user_profile_media_created_by_rels" (
        "id" serial PRIMARY KEY NOT NULL,
        "order" integer,
        "parent_id" integer NOT NULL,
        "path" varchar NOT NULL,
        "basic_users_id" integer,
        "patients_id" integer
   );

   ALTER TABLE "user_profile_media_user_rels" ADD CONSTRAINT "user_profile_media_user_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."user_profile_media"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "user_profile_media_user_rels" ADD CONSTRAINT "user_profile_media_user_rels_basic_users_fk" FOREIGN KEY ("basic_users_id") REFERENCES "public"."basic_users"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "user_profile_media_user_rels" ADD CONSTRAINT "user_profile_media_user_rels_patients_fk" FOREIGN KEY ("patients_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
   CREATE INDEX "user_profile_media_user_rels_order_idx" ON "user_profile_media_user_rels" USING btree ("order");
   CREATE INDEX "user_profile_media_user_rels_parent_idx" ON "user_profile_media_user_rels" USING btree ("parent_id");
   CREATE INDEX "user_profile_media_user_rels_path_idx" ON "user_profile_media_user_rels" USING btree ("path");
   CREATE INDEX "user_profile_media_user_rels_basic_users_id_idx" ON "user_profile_media_user_rels" USING btree ("basic_users_id");
   CREATE INDEX "user_profile_media_user_rels_patients_id_idx" ON "user_profile_media_user_rels" USING btree ("patients_id");

   ALTER TABLE "user_profile_media_created_by_rels" ADD CONSTRAINT "user_profile_media_created_by_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."user_profile_media"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "user_profile_media_created_by_rels" ADD CONSTRAINT "user_profile_media_created_by_rels_basic_users_fk" FOREIGN KEY ("basic_users_id") REFERENCES "public"."basic_users"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "user_profile_media_created_by_rels" ADD CONSTRAINT "user_profile_media_created_by_rels_patients_fk" FOREIGN KEY ("patients_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
   CREATE INDEX "user_profile_media_created_by_rels_order_idx" ON "user_profile_media_created_by_rels" USING btree ("order");
   CREATE INDEX "user_profile_media_created_by_rels_parent_idx" ON "user_profile_media_created_by_rels" USING btree ("parent_id");
   CREATE INDEX "user_profile_media_created_by_rels_path_idx" ON "user_profile_media_created_by_rels" USING btree ("path");
   CREATE INDEX "user_profile_media_created_by_rels_basic_users_id_idx" ON "user_profile_media_created_by_rels" USING btree ("basic_users_id");
   CREATE INDEX "user_profile_media_created_by_rels_patients_id_idx" ON "user_profile_media_created_by_rels" USING btree ("patients_id");

   ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "doctor_media_id" integer;
   ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "user_profile_media_id" integer;
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_doctor_media_fk" FOREIGN KEY ("doctor_media_id") REFERENCES "public"."doctor_media"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_user_profile_media_fk" FOREIGN KEY ("user_profile_media_id") REFERENCES "public"."user_profile_media"("id") ON DELETE cascade ON UPDATE no action;
   CREATE INDEX "payload_locked_documents_rels_doctor_media_id_idx" ON "payload_locked_documents_rels" USING btree ("doctor_media_id");
   CREATE INDEX "payload_locked_documents_rels_user_profile_media_id_idx" ON "payload_locked_documents_rels" USING btree ("user_profile_media_id");

   ALTER TABLE "pages_blocks_benefits_block_cards" ADD CONSTRAINT "pages_blocks_benefits_block_cards_image_id_platform_content_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "pages_blocks_content_columns" ADD CONSTRAINT "pages_blocks_content_columns_image_id_platform_content_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "pages_blocks_media_block" ADD CONSTRAINT "pages_blocks_media_block_media_id_platform_content_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "pages" ADD CONSTRAINT "pages_hero_media_id_platform_content_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "pages" ADD CONSTRAINT "pages_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "_pages_v_blocks_benefits_block_cards" ADD CONSTRAINT "_pages_v_blocks_benefits_block_cards_image_id_platform_content_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "_pages_v_blocks_content_columns" ADD CONSTRAINT "_pages_v_blocks_content_columns_image_id_platform_content_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "_pages_v_blocks_media_block" ADD CONSTRAINT "_pages_v_blocks_media_block_media_id_platform_content_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_hero_media_id_platform_content_media_id_fk" FOREIGN KEY ("version_hero_media_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "posts" ADD CONSTRAINT "posts_hero_image_id_platform_content_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "posts" ADD CONSTRAINT "posts_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_hero_image_id_platform_content_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "accreditation" ADD CONSTRAINT "accreditation_icon_id_platform_content_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "medical_specialties" ADD CONSTRAINT "medical_specialties_icon_id_platform_content_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "search" ADD CONSTRAINT "search_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "doctors" ADD CONSTRAINT "doctors_profile_image_id_doctor_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."doctor_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "basic_users" ADD CONSTRAINT "basic_users_profile_image_id_user_profile_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."user_profile_media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "patients" ADD CONSTRAINT "patients_profile_image_id_user_profile_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."user_profile_media"("id") ON DELETE set null ON UPDATE no action;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "patients" DROP CONSTRAINT "patients_profile_image_id_user_profile_media_id_fk";
   ALTER TABLE "basic_users" DROP CONSTRAINT "basic_users_profile_image_id_user_profile_media_id_fk";
   ALTER TABLE "doctors" DROP CONSTRAINT "doctors_profile_image_id_doctor_media_id_fk";
   ALTER TABLE "search" DROP CONSTRAINT "search_meta_image_id_platform_content_media_id_fk";
   ALTER TABLE "medical_specialties" DROP CONSTRAINT "medical_specialties_icon_id_platform_content_media_id_fk";
   ALTER TABLE "accreditation" DROP CONSTRAINT "accreditation_icon_id_platform_content_media_id_fk";
   ALTER TABLE "_posts_v" DROP CONSTRAINT "_posts_v_version_meta_image_id_platform_content_media_id_fk";
   ALTER TABLE "_posts_v" DROP CONSTRAINT "_posts_v_version_hero_image_id_platform_content_media_id_fk";
   ALTER TABLE "posts" DROP CONSTRAINT "posts_meta_image_id_platform_content_media_id_fk";
   ALTER TABLE "posts" DROP CONSTRAINT "posts_hero_image_id_platform_content_media_id_fk";
   ALTER TABLE "_pages_v" DROP CONSTRAINT "_pages_v_version_meta_image_id_platform_content_media_id_fk";
   ALTER TABLE "_pages_v" DROP CONSTRAINT "_pages_v_version_hero_media_id_platform_content_media_id_fk";
   ALTER TABLE "_pages_v_blocks_media_block" DROP CONSTRAINT "_pages_v_blocks_media_block_media_id_platform_content_media_id_fk";
   ALTER TABLE "_pages_v_blocks_content_columns" DROP CONSTRAINT "_pages_v_blocks_content_columns_image_id_platform_content_media_id_fk";
   ALTER TABLE "_pages_v_blocks_benefits_block_cards" DROP CONSTRAINT "_pages_v_blocks_benefits_block_cards_image_id_platform_content_media_id_fk";
   ALTER TABLE "pages" DROP CONSTRAINT "pages_meta_image_id_platform_content_media_id_fk";
   ALTER TABLE "pages" DROP CONSTRAINT "pages_hero_media_id_platform_content_media_id_fk";
   ALTER TABLE "pages_blocks_media_block" DROP CONSTRAINT "pages_blocks_media_block_media_id_platform_content_media_id_fk";
   ALTER TABLE "pages_blocks_content_columns" DROP CONSTRAINT "pages_blocks_content_columns_image_id_platform_content_media_id_fk";
   ALTER TABLE "pages_blocks_benefits_block_cards" DROP CONSTRAINT "pages_blocks_benefits_block_cards_image_id_platform_content_media_id_fk";

   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_user_profile_media_fk";
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_doctor_media_fk";
   DROP INDEX "payload_locked_documents_rels_user_profile_media_id_idx";
   DROP INDEX "payload_locked_documents_rels_doctor_media_id_idx";
   ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "user_profile_media_id";
   ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "doctor_media_id";

   DROP INDEX "user_profile_media_created_by_rels_patients_id_idx";
   DROP INDEX "user_profile_media_created_by_rels_basic_users_id_idx";
   DROP INDEX "user_profile_media_created_by_rels_path_idx";
   DROP INDEX "user_profile_media_created_by_rels_parent_idx";
   DROP INDEX "user_profile_media_created_by_rels_order_idx";
   ALTER TABLE "user_profile_media_created_by_rels" DROP CONSTRAINT "user_profile_media_created_by_rels_patients_fk";
   ALTER TABLE "user_profile_media_created_by_rels" DROP CONSTRAINT "user_profile_media_created_by_rels_basic_users_fk";
   ALTER TABLE "user_profile_media_created_by_rels" DROP CONSTRAINT "user_profile_media_created_by_rels_parent_fk";
   DROP TABLE "user_profile_media_created_by_rels";

   DROP INDEX "user_profile_media_user_rels_patients_id_idx";
   DROP INDEX "user_profile_media_user_rels_basic_users_id_idx";
   DROP INDEX "user_profile_media_user_rels_path_idx";
   DROP INDEX "user_profile_media_user_rels_parent_idx";
   DROP INDEX "user_profile_media_user_rels_order_idx";
   ALTER TABLE "user_profile_media_user_rels" DROP CONSTRAINT "user_profile_media_user_rels_patients_fk";
   ALTER TABLE "user_profile_media_user_rels" DROP CONSTRAINT "user_profile_media_user_rels_basic_users_fk";
   ALTER TABLE "user_profile_media_user_rels" DROP CONSTRAINT "user_profile_media_user_rels_parent_fk";
   DROP TABLE "user_profile_media_user_rels";

   DROP INDEX "user_profile_media_sizes_og_sizes_og_filename_idx";
   DROP INDEX "user_profile_media_sizes_xlarge_sizes_xlarge_filename_idx";
   DROP INDEX "user_profile_media_sizes_large_sizes_large_filename_idx";
   DROP INDEX "user_profile_media_sizes_medium_sizes_medium_filename_idx";
   DROP INDEX "user_profile_media_sizes_small_sizes_small_filename_idx";
   DROP INDEX "user_profile_media_sizes_square_sizes_square_filename_idx";
   DROP INDEX "user_profile_media_sizes_thumbnail_sizes_thumbnail_filename_idx";
   DROP INDEX "user_profile_media_filename_idx";
   DROP INDEX "user_profile_media_deleted_at_idx";
   DROP INDEX "user_profile_media_created_at_idx";
   DROP INDEX "user_profile_media_updated_at_idx";
   DROP TABLE "user_profile_media";

   DROP INDEX "doctor_media_sizes_og_sizes_og_filename_idx";
   DROP INDEX "doctor_media_sizes_xlarge_sizes_xlarge_filename_idx";
   DROP INDEX "doctor_media_sizes_large_sizes_large_filename_idx";
   DROP INDEX "doctor_media_sizes_medium_sizes_medium_filename_idx";
   DROP INDEX "doctor_media_sizes_small_sizes_small_filename_idx";
   DROP INDEX "doctor_media_sizes_square_sizes_square_filename_idx";
   DROP INDEX "doctor_media_sizes_thumbnail_sizes_thumbnail_filename_idx";
   DROP INDEX "doctor_media_filename_idx";
   DROP INDEX "doctor_media_deleted_at_idx";
   DROP INDEX "doctor_media_created_at_idx";
   DROP INDEX "doctor_media_updated_at_idx";
   DROP INDEX "doctor_media_created_by_idx";
   DROP INDEX "doctor_media_clinic_idx";
   DROP INDEX "doctor_media_doctor_idx";
   ALTER TABLE "doctor_media" DROP CONSTRAINT "doctor_media_created_by_id_basic_users_id_fk";
   ALTER TABLE "doctor_media" DROP CONSTRAINT "doctor_media_clinic_id_clinics_id_fk";
   ALTER TABLE "doctor_media" DROP CONSTRAINT "doctor_media_doctor_id_doctors_id_fk";
   DROP TABLE "doctor_media";

   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_platform_content_media_fk";
   DROP INDEX "payload_locked_documents_rels_platform_content_media_id_idx";
   ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "platform_content_media_id" TO "media_id";
   CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");

   DROP INDEX "platform_content_media_created_by_idx";
   ALTER TABLE "platform_content_media" DROP CONSTRAINT "platform_content_media_created_by_id_basic_users_id_fk";
   ALTER TABLE "platform_content_media" DROP COLUMN "created_by_id";
   ALTER TABLE "platform_content_media" ALTER COLUMN "alt" DROP NOT NULL;
   ALTER TABLE "platform_content_media" ALTER COLUMN "storage_path" DROP NOT NULL;
   ALTER TABLE "platform_content_media" ALTER COLUMN "caption" TYPE jsonb USING caption::jsonb;
   ALTER TABLE "platform_content_media" RENAME COLUMN "storage_path" TO "prefix";

   ALTER INDEX "platform_content_media_sizes_og_sizes_og_filename_idx" RENAME TO "media_sizes_og_sizes_og_filename_idx";
   ALTER INDEX "platform_content_media_sizes_xlarge_sizes_xlarge_filename_idx" RENAME TO "media_sizes_xlarge_sizes_xlarge_filename_idx";
   ALTER INDEX "platform_content_media_sizes_large_sizes_large_filename_idx" RENAME TO "media_sizes_large_sizes_large_filename_idx";
   ALTER INDEX "platform_content_media_sizes_medium_sizes_medium_filename_idx" RENAME TO "media_sizes_medium_sizes_medium_filename_idx";
   ALTER INDEX "platform_content_media_sizes_small_sizes_small_filename_idx" RENAME TO "media_sizes_small_sizes_small_filename_idx";
   ALTER INDEX "platform_content_media_sizes_square_sizes_square_filename_idx" RENAME TO "media_sizes_square_sizes_square_filename_idx";
   ALTER INDEX "platform_content_media_sizes_thumbnail_sizes_thumbnail_filename_idx" RENAME TO "media_sizes_thumbnail_sizes_thumbnail_filename_idx";
   ALTER INDEX "platform_content_media_filename_idx" RENAME TO "media_filename_idx";
   ALTER INDEX "platform_content_media_deleted_at_idx" RENAME TO "media_deleted_at_idx";
   ALTER INDEX "platform_content_media_created_at_idx" RENAME TO "media_created_at_idx";
   ALTER INDEX "platform_content_media_updated_at_idx" RENAME TO "media_updated_at_idx";

   ALTER TABLE "platform_content_media" ALTER COLUMN "id" SET DEFAULT nextval('media_id_seq');
   ALTER SEQUENCE IF EXISTS "platform_content_media_id_seq" RENAME TO "media_id_seq";
   ALTER TABLE "platform_content_media" RENAME TO "media";
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;

   ALTER TABLE "pages_blocks_benefits_block_cards" ADD CONSTRAINT "pages_blocks_benefits_block_cards_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "pages_blocks_content_columns" ADD CONSTRAINT "pages_blocks_content_columns_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "pages_blocks_media_block" ADD CONSTRAINT "pages_blocks_media_block_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "pages" ADD CONSTRAINT "pages_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "pages" ADD CONSTRAINT "pages_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "_pages_v_blocks_benefits_block_cards" ADD CONSTRAINT "_pages_v_blocks_benefits_block_cards_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "_pages_v_blocks_content_columns" ADD CONSTRAINT "_pages_v_blocks_content_columns_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "_pages_v_blocks_media_block" ADD CONSTRAINT "_pages_v_blocks_media_block_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_hero_media_id_media_id_fk" FOREIGN KEY ("version_hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "posts" ADD CONSTRAINT "posts_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "posts" ADD CONSTRAINT "posts_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "accreditation" ADD CONSTRAINT "accreditation_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "medical_specialties" ADD CONSTRAINT "medical_specialties_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "search" ADD CONSTRAINT "search_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "doctors" ADD CONSTRAINT "doctors_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "basic_users" ADD CONSTRAINT "basic_users_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "patients" ADD CONSTRAINT "patients_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  `)
}
