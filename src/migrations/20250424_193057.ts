import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "pages_breadcrumbs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"doc_id" integer,
  	"url" varchar,
  	"label" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_pages_v_version_breadcrumbs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"doc_id" integer,
  	"url" varchar,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "pages" ADD COLUMN "parent_id" integer;
  ALTER TABLE "_pages_v" ADD COLUMN "version_parent_id" integer;
  ALTER TABLE "posts" ADD COLUMN "excerpt" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_excerpt" varchar;
  DO $$ BEGIN
   ALTER TABLE "pages_breadcrumbs" ADD CONSTRAINT "pages_breadcrumbs_doc_id_pages_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "pages_breadcrumbs" ADD CONSTRAINT "pages_breadcrumbs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_pages_v_version_breadcrumbs" ADD CONSTRAINT "_pages_v_version_breadcrumbs_doc_id_pages_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_pages_v_version_breadcrumbs" ADD CONSTRAINT "_pages_v_version_breadcrumbs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "pages_breadcrumbs_order_idx" ON "pages_breadcrumbs" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_breadcrumbs_parent_id_idx" ON "pages_breadcrumbs" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_breadcrumbs_doc_idx" ON "pages_breadcrumbs" USING btree ("doc_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_version_breadcrumbs_order_idx" ON "_pages_v_version_breadcrumbs" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_pages_v_version_breadcrumbs_parent_id_idx" ON "_pages_v_version_breadcrumbs" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_version_breadcrumbs_doc_idx" ON "_pages_v_version_breadcrumbs" USING btree ("doc_id");
  DO $$ BEGIN
   ALTER TABLE "pages" ADD CONSTRAINT "pages_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_parent_id_pages_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "pages_parent_idx" ON "pages" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_version_version_parent_idx" ON "_pages_v" USING btree ("version_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_breadcrumbs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_version_breadcrumbs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_breadcrumbs" CASCADE;
  DROP TABLE "_pages_v_version_breadcrumbs" CASCADE;
  ALTER TABLE "pages" DROP CONSTRAINT "pages_parent_id_pages_id_fk";
  
  ALTER TABLE "_pages_v" DROP CONSTRAINT "_pages_v_version_parent_id_pages_id_fk";
  
  DROP INDEX IF EXISTS "pages_parent_idx";
  DROP INDEX IF EXISTS "_pages_v_version_version_parent_idx";
  ALTER TABLE "pages" DROP COLUMN IF EXISTS "parent_id";
  ALTER TABLE "_pages_v" DROP COLUMN IF EXISTS "version_parent_id";
  ALTER TABLE "posts" DROP COLUMN IF EXISTS "excerpt";
  ALTER TABLE "_posts_v" DROP COLUMN IF EXISTS "version_excerpt";`)
}
