import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "pages_blocks_blog_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"subtitle" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_blog_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"subtitle" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "posts_populated_authors" ADD COLUMN "avatar" varchar;
  ALTER TABLE "_posts_v_version_populated_authors" ADD COLUMN "avatar" varchar;
  ALTER TABLE "platform_content_media" ADD COLUMN "stable_id" varchar;
  ALTER TABLE "basic_users" ADD COLUMN "stable_id" varchar;
  ALTER TABLE "pages_blocks_blog_hero" ADD CONSTRAINT "pages_blocks_blog_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_blog_hero" ADD CONSTRAINT "_pages_v_blocks_blog_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_blog_hero_order_idx" ON "pages_blocks_blog_hero" USING btree ("_order");
  CREATE INDEX "pages_blocks_blog_hero_parent_id_idx" ON "pages_blocks_blog_hero" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_blog_hero_path_idx" ON "pages_blocks_blog_hero" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_blog_hero_order_idx" ON "_pages_v_blocks_blog_hero" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_blog_hero_parent_id_idx" ON "_pages_v_blocks_blog_hero" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_blog_hero_path_idx" ON "_pages_v_blocks_blog_hero" USING btree ("_path");
  CREATE UNIQUE INDEX "platform_content_media_stable_id_idx" ON "platform_content_media" USING btree ("stable_id");
  CREATE UNIQUE INDEX "basic_users_stable_id_idx" ON "basic_users" USING btree ("stable_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_blog_hero" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_blog_hero" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_blog_hero" CASCADE;
  DROP TABLE "_pages_v_blocks_blog_hero" CASCADE;
  DROP INDEX "platform_content_media_stable_id_idx";
  DROP INDEX "basic_users_stable_id_idx";
  ALTER TABLE "posts_populated_authors" DROP COLUMN "avatar";
  ALTER TABLE "_posts_v_version_populated_authors" DROP COLUMN "avatar";
  ALTER TABLE "platform_content_media" DROP COLUMN "stable_id";
  ALTER TABLE "basic_users" DROP COLUMN "stable_id";`)
}
