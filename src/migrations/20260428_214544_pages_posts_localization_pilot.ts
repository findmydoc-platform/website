import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('en', 'de');
  CREATE TYPE "public"."enum__pages_v_published_locale" AS ENUM('en', 'de');
  CREATE TYPE "public"."enum__posts_v_published_locale" AS ENUM('en', 'de');
  CREATE TYPE "public"."enum_exports_locale" AS ENUM('all', 'en', 'de');
  CREATE TABLE "pages_locales" (
  	"title" varchar,
  	"meta_title" varchar,
  	"meta_image_id" integer,
  	"meta_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_locales" (
  	"version_title" varchar,
  	"version_meta_title" varchar,
  	"version_meta_image_id" integer,
  	"version_meta_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "posts_locales" (
  	"title" varchar,
  	"content" jsonb,
  	"excerpt" varchar,
  	"meta_title" varchar,
  	"meta_image_id" integer,
  	"meta_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_posts_v_locales" (
  	"version_title" varchar,
  	"version_content" jsonb,
  	"version_excerpt" varchar,
  	"version_meta_title" varchar,
  	"version_meta_image_id" integer,
  	"version_meta_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "pages" DROP CONSTRAINT "pages_meta_image_id_platform_content_media_id_fk";
  
  ALTER TABLE "_pages_v" DROP CONSTRAINT "_pages_v_version_meta_image_id_platform_content_media_id_fk";
  
  ALTER TABLE "posts" DROP CONSTRAINT "posts_meta_image_id_platform_content_media_id_fk";
  
  ALTER TABLE "_posts_v" DROP CONSTRAINT "_posts_v_version_meta_image_id_platform_content_media_id_fk";
  
  DROP INDEX "pages_meta_meta_image_idx";
  DROP INDEX "_pages_v_version_meta_version_meta_image_idx";
  DROP INDEX "posts_meta_meta_image_idx";
  DROP INDEX "_posts_v_version_meta_version_meta_image_idx";
  DROP INDEX "pages_rels_pages_id_idx";
  DROP INDEX "pages_rels_posts_id_idx";
  DROP INDEX "pages_rels_categories_id_idx";
  DROP INDEX "_pages_v_rels_pages_id_idx";
  DROP INDEX "_pages_v_rels_posts_id_idx";
  DROP INDEX "_pages_v_rels_categories_id_idx";
  ALTER TABLE "pages_blocks_blog_hero" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "pages_blocks_cta_links" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "pages_blocks_content_columns" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "pages_blocks_content" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "pages_blocks_media_block" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "pages_blocks_archive" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "pages_blocks_form_block" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "pages_breadcrumbs" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "pages_rels" ADD COLUMN "locale" "_locales" DEFAULT 'en';
  ALTER TABLE "_pages_v_blocks_blog_hero" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_pages_v_blocks_cta_links" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_pages_v_blocks_cta" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_pages_v_blocks_content_columns" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_pages_v_blocks_content" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_pages_v_blocks_media_block" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_pages_v_blocks_archive" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_pages_v_blocks_form_block" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_pages_v_version_breadcrumbs" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "_pages_v" ADD COLUMN "snapshot" boolean DEFAULT false;
  ALTER TABLE "_pages_v" ADD COLUMN "published_locale" "enum__pages_v_published_locale";
  ALTER TABLE "_pages_v_rels" ADD COLUMN "locale" "_locales" DEFAULT 'en';
  ALTER TABLE "_posts_v" ADD COLUMN "snapshot" boolean DEFAULT false;
  ALTER TABLE "_posts_v" ADD COLUMN "published_locale" "enum__posts_v_published_locale";
  ALTER TABLE "categories_breadcrumbs" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "medical_specialties_breadcrumbs" ADD COLUMN "_locale" "_locales" DEFAULT 'en' NOT NULL;
  ALTER TABLE "exports" ADD COLUMN "locale" "enum_exports_locale" DEFAULT 'all';
  ALTER TABLE "pages_locales" ADD CONSTRAINT "pages_locales_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_locales" ADD CONSTRAINT "pages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_locales" ADD CONSTRAINT "_pages_v_locales_version_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_locales" ADD CONSTRAINT "_pages_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_locales" ADD CONSTRAINT "posts_locales_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts_locales" ADD CONSTRAINT "posts_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_locales" ADD CONSTRAINT "_posts_v_locales_version_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v_locales" ADD CONSTRAINT "_posts_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_meta_meta_image_idx" ON "pages_locales" USING btree ("meta_image_id","_locale");
  CREATE UNIQUE INDEX "pages_locales_locale_parent_id_unique" ON "pages_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_version_meta_version_meta_image_idx" ON "_pages_v_locales" USING btree ("version_meta_image_id","_locale");
  CREATE UNIQUE INDEX "_pages_v_locales_locale_parent_id_unique" ON "_pages_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "posts_meta_meta_image_idx" ON "posts_locales" USING btree ("meta_image_id","_locale");
  CREATE UNIQUE INDEX "posts_locales_locale_parent_id_unique" ON "posts_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_posts_v_version_meta_version_meta_image_idx" ON "_posts_v_locales" USING btree ("version_meta_image_id","_locale");
  CREATE UNIQUE INDEX "_posts_v_locales_locale_parent_id_unique" ON "_posts_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_blog_hero_locale_idx" ON "pages_blocks_blog_hero" USING btree ("_locale");
  CREATE INDEX "pages_blocks_cta_links_locale_idx" ON "pages_blocks_cta_links" USING btree ("_locale");
  CREATE INDEX "pages_blocks_cta_locale_idx" ON "pages_blocks_cta" USING btree ("_locale");
  CREATE INDEX "pages_blocks_content_columns_locale_idx" ON "pages_blocks_content_columns" USING btree ("_locale");
  CREATE INDEX "pages_blocks_content_locale_idx" ON "pages_blocks_content" USING btree ("_locale");
  CREATE INDEX "pages_blocks_media_block_locale_idx" ON "pages_blocks_media_block" USING btree ("_locale");
  CREATE INDEX "pages_blocks_archive_locale_idx" ON "pages_blocks_archive" USING btree ("_locale");
  CREATE INDEX "pages_blocks_form_block_locale_idx" ON "pages_blocks_form_block" USING btree ("_locale");
  CREATE INDEX "pages_breadcrumbs_locale_idx" ON "pages_breadcrumbs" USING btree ("_locale");
  CREATE INDEX "pages_rels_locale_idx" ON "pages_rels" USING btree ("locale");
  CREATE INDEX "_pages_v_blocks_blog_hero_locale_idx" ON "_pages_v_blocks_blog_hero" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_cta_links_locale_idx" ON "_pages_v_blocks_cta_links" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_cta_locale_idx" ON "_pages_v_blocks_cta" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_content_columns_locale_idx" ON "_pages_v_blocks_content_columns" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_content_locale_idx" ON "_pages_v_blocks_content" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_media_block_locale_idx" ON "_pages_v_blocks_media_block" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_archive_locale_idx" ON "_pages_v_blocks_archive" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_form_block_locale_idx" ON "_pages_v_blocks_form_block" USING btree ("_locale");
  CREATE INDEX "_pages_v_version_breadcrumbs_locale_idx" ON "_pages_v_version_breadcrumbs" USING btree ("_locale");
  CREATE INDEX "_pages_v_snapshot_idx" ON "_pages_v" USING btree ("snapshot");
  CREATE INDEX "_pages_v_published_locale_idx" ON "_pages_v" USING btree ("published_locale");
  CREATE INDEX "_pages_v_rels_locale_idx" ON "_pages_v_rels" USING btree ("locale");
  CREATE INDEX "_posts_v_snapshot_idx" ON "_posts_v" USING btree ("snapshot");
  CREATE INDEX "_posts_v_published_locale_idx" ON "_posts_v" USING btree ("published_locale");
  CREATE INDEX "categories_breadcrumbs_locale_idx" ON "categories_breadcrumbs" USING btree ("_locale");
  CREATE INDEX "medical_specialties_breadcrumbs_locale_idx" ON "medical_specialties_breadcrumbs" USING btree ("_locale");
  CREATE INDEX "pages_rels_pages_id_idx" ON "pages_rels" USING btree ("pages_id","locale");
  CREATE INDEX "pages_rels_posts_id_idx" ON "pages_rels" USING btree ("posts_id","locale");
  CREATE INDEX "pages_rels_categories_id_idx" ON "pages_rels" USING btree ("categories_id","locale");
  CREATE INDEX "_pages_v_rels_pages_id_idx" ON "_pages_v_rels" USING btree ("pages_id","locale");
  CREATE INDEX "_pages_v_rels_posts_id_idx" ON "_pages_v_rels" USING btree ("posts_id","locale");
  CREATE INDEX "_pages_v_rels_categories_id_idx" ON "_pages_v_rels" USING btree ("categories_id","locale");
  INSERT INTO "pages_locales" ("title", "meta_title", "meta_image_id", "meta_description", "_locale", "_parent_id")
  SELECT "title", "meta_title", "meta_image_id", "meta_description", 'en', "id"
  FROM "pages";
  INSERT INTO "_pages_v_locales" ("version_title", "version_meta_title", "version_meta_image_id", "version_meta_description", "_locale", "_parent_id")
  SELECT "version_title", "version_meta_title", "version_meta_image_id", "version_meta_description", 'en', "id"
  FROM "_pages_v";
  INSERT INTO "posts_locales" ("title", "content", "excerpt", "meta_title", "meta_image_id", "meta_description", "_locale", "_parent_id")
  SELECT "title", "content", "excerpt", "meta_title", "meta_image_id", "meta_description", 'en', "id"
  FROM "posts";
  INSERT INTO "_posts_v_locales" ("version_title", "version_content", "version_excerpt", "version_meta_title", "version_meta_image_id", "version_meta_description", "_locale", "_parent_id")
  SELECT "version_title", "version_content", "version_excerpt", "version_meta_title", "version_meta_image_id", "version_meta_description", 'en', "id"
  FROM "_posts_v";
  UPDATE "_pages_v"
  SET "published_locale" = 'en'
  WHERE "published_locale" IS NULL
    AND "version__status" = 'published';
  UPDATE "_posts_v"
  SET "published_locale" = 'en'
  WHERE "published_locale" IS NULL
    AND "version__status" = 'published';
  UPDATE "pages_rels"
  SET "locale" = 'en'
  WHERE "locale" IS NULL;
  UPDATE "_pages_v_rels"
  SET "locale" = 'en'
  WHERE "locale" IS NULL;
  UPDATE "exports"
  SET "locale" = 'all'
  WHERE "locale" IS NULL;
  ALTER TABLE "pages_blocks_blog_hero" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_blocks_cta_links" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_blocks_cta" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_blocks_content_columns" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_blocks_content" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_blocks_media_block" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_blocks_archive" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_blocks_form_block" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_breadcrumbs" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_rels" ALTER COLUMN "locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_blog_hero" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_cta_links" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_cta" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_content_columns" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_content" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_media_block" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_archive" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_form_block" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_version_breadcrumbs" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v" ALTER COLUMN "snapshot" DROP DEFAULT;
  ALTER TABLE "_pages_v_rels" ALTER COLUMN "locale" DROP DEFAULT;
  ALTER TABLE "_posts_v" ALTER COLUMN "snapshot" DROP DEFAULT;
  ALTER TABLE "categories_breadcrumbs" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "medical_specialties_breadcrumbs" ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages" DROP COLUMN "title";
  ALTER TABLE "pages" DROP COLUMN "meta_title";
  ALTER TABLE "pages" DROP COLUMN "meta_image_id";
  ALTER TABLE "pages" DROP COLUMN "meta_description";
  ALTER TABLE "_pages_v" DROP COLUMN "version_title";
  ALTER TABLE "_pages_v" DROP COLUMN "version_meta_title";
  ALTER TABLE "_pages_v" DROP COLUMN "version_meta_image_id";
  ALTER TABLE "_pages_v" DROP COLUMN "version_meta_description";
  ALTER TABLE "posts" DROP COLUMN "title";
  ALTER TABLE "posts" DROP COLUMN "content";
  ALTER TABLE "posts" DROP COLUMN "excerpt";
  ALTER TABLE "posts" DROP COLUMN "meta_title";
  ALTER TABLE "posts" DROP COLUMN "meta_image_id";
  ALTER TABLE "posts" DROP COLUMN "meta_description";
  ALTER TABLE "_posts_v" DROP COLUMN "version_title";
  ALTER TABLE "_posts_v" DROP COLUMN "version_content";
  ALTER TABLE "_posts_v" DROP COLUMN "version_excerpt";
  ALTER TABLE "_posts_v" DROP COLUMN "version_meta_title";
  ALTER TABLE "_posts_v" DROP COLUMN "version_meta_image_id";
  ALTER TABLE "_posts_v" DROP COLUMN "version_meta_description";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_locales" CASCADE;
  DROP TABLE "_pages_v_locales" CASCADE;
  DROP TABLE "posts_locales" CASCADE;
  DROP TABLE "_posts_v_locales" CASCADE;
  DROP INDEX "pages_blocks_blog_hero_locale_idx";
  DROP INDEX "pages_blocks_cta_links_locale_idx";
  DROP INDEX "pages_blocks_cta_locale_idx";
  DROP INDEX "pages_blocks_content_columns_locale_idx";
  DROP INDEX "pages_blocks_content_locale_idx";
  DROP INDEX "pages_blocks_media_block_locale_idx";
  DROP INDEX "pages_blocks_archive_locale_idx";
  DROP INDEX "pages_blocks_form_block_locale_idx";
  DROP INDEX "pages_breadcrumbs_locale_idx";
  DROP INDEX "pages_rels_locale_idx";
  DROP INDEX "_pages_v_blocks_blog_hero_locale_idx";
  DROP INDEX "_pages_v_blocks_cta_links_locale_idx";
  DROP INDEX "_pages_v_blocks_cta_locale_idx";
  DROP INDEX "_pages_v_blocks_content_columns_locale_idx";
  DROP INDEX "_pages_v_blocks_content_locale_idx";
  DROP INDEX "_pages_v_blocks_media_block_locale_idx";
  DROP INDEX "_pages_v_blocks_archive_locale_idx";
  DROP INDEX "_pages_v_blocks_form_block_locale_idx";
  DROP INDEX "_pages_v_version_breadcrumbs_locale_idx";
  DROP INDEX "_pages_v_snapshot_idx";
  DROP INDEX "_pages_v_published_locale_idx";
  DROP INDEX "_pages_v_rels_locale_idx";
  DROP INDEX "_posts_v_snapshot_idx";
  DROP INDEX "_posts_v_published_locale_idx";
  DROP INDEX "categories_breadcrumbs_locale_idx";
  DROP INDEX "medical_specialties_breadcrumbs_locale_idx";
  DROP INDEX "pages_rels_pages_id_idx";
  DROP INDEX "pages_rels_posts_id_idx";
  DROP INDEX "pages_rels_categories_id_idx";
  DROP INDEX "_pages_v_rels_pages_id_idx";
  DROP INDEX "_pages_v_rels_posts_id_idx";
  DROP INDEX "_pages_v_rels_categories_id_idx";
  ALTER TABLE "pages" ADD COLUMN "title" varchar;
  ALTER TABLE "pages" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "pages" ADD COLUMN "meta_image_id" integer;
  ALTER TABLE "pages" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_title" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_meta_title" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_meta_image_id" integer;
  ALTER TABLE "_pages_v" ADD COLUMN "version_meta_description" varchar;
  ALTER TABLE "posts" ADD COLUMN "title" varchar;
  ALTER TABLE "posts" ADD COLUMN "content" jsonb;
  ALTER TABLE "posts" ADD COLUMN "excerpt" varchar;
  ALTER TABLE "posts" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "posts" ADD COLUMN "meta_image_id" integer;
  ALTER TABLE "posts" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_title" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_content" jsonb;
  ALTER TABLE "_posts_v" ADD COLUMN "version_excerpt" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_meta_title" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_meta_image_id" integer;
  ALTER TABLE "_posts_v" ADD COLUMN "version_meta_description" varchar;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_meta_image_id_platform_content_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pages_meta_meta_image_idx" ON "pages" USING btree ("meta_image_id");
  CREATE INDEX "_pages_v_version_meta_version_meta_image_idx" ON "_pages_v" USING btree ("version_meta_image_id");
  CREATE INDEX "posts_meta_meta_image_idx" ON "posts" USING btree ("meta_image_id");
  CREATE INDEX "_posts_v_version_meta_version_meta_image_idx" ON "_posts_v" USING btree ("version_meta_image_id");
  CREATE INDEX "pages_rels_pages_id_idx" ON "pages_rels" USING btree ("pages_id");
  CREATE INDEX "pages_rels_posts_id_idx" ON "pages_rels" USING btree ("posts_id");
  CREATE INDEX "pages_rels_categories_id_idx" ON "pages_rels" USING btree ("categories_id");
  CREATE INDEX "_pages_v_rels_pages_id_idx" ON "_pages_v_rels" USING btree ("pages_id");
  CREATE INDEX "_pages_v_rels_posts_id_idx" ON "_pages_v_rels" USING btree ("posts_id");
  CREATE INDEX "_pages_v_rels_categories_id_idx" ON "_pages_v_rels" USING btree ("categories_id");
  ALTER TABLE "pages_blocks_blog_hero" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_cta_links" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_content_columns" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_content" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_media_block" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_archive" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_form_block" DROP COLUMN "_locale";
  ALTER TABLE "pages_breadcrumbs" DROP COLUMN "_locale";
  ALTER TABLE "pages_rels" DROP COLUMN "locale";
  ALTER TABLE "_pages_v_blocks_blog_hero" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_cta_links" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_cta" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_content_columns" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_content" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_media_block" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_archive" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_form_block" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_version_breadcrumbs" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v" DROP COLUMN "snapshot";
  ALTER TABLE "_pages_v" DROP COLUMN "published_locale";
  ALTER TABLE "_pages_v_rels" DROP COLUMN "locale";
  ALTER TABLE "_posts_v" DROP COLUMN "snapshot";
  ALTER TABLE "_posts_v" DROP COLUMN "published_locale";
  ALTER TABLE "categories_breadcrumbs" DROP COLUMN "_locale";
  ALTER TABLE "medical_specialties_breadcrumbs" DROP COLUMN "_locale";
  ALTER TABLE "exports" DROP COLUMN "locale";
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum__pages_v_published_locale";
  DROP TYPE "public"."enum__posts_v_published_locale";
  DROP TYPE "public"."enum_exports_locale";`)
}
