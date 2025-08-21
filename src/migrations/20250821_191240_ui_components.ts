import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_blocks_content_columns_image_position" AS ENUM('top', 'left', 'right', 'bottom');
  CREATE TYPE "public"."enum_pages_blocks_content_columns_image_size" AS ENUM('content', 'wide', 'full');
  CREATE TYPE "public"."enum_pages_blocks_layout_block_background" AS ENUM('primary', 'secondary', 'accent', 'accent-2');
  CREATE TYPE "public"."enum_pages_blocks_layout_block_width" AS ENUM('full', 'two-thirds', 'half', 'third');
  CREATE TYPE "public"."enum_pages_blocks_layout_block_accent" AS ENUM('none', 'left', 'right');
  CREATE TYPE "public"."enum_pages_blocks_newsletter_block_background" AS ENUM('primary', 'secondary', 'accent', 'accent-2');
  CREATE TYPE "public"."enum_pages_blocks_newsletter_block_textcolor" AS ENUM('primary', 'secondary', 'accent', 'accent-2');
  CREATE TYPE "public"."text_col" AS ENUM('primary', 'secondary', 'accent', 'accent-2');
  CREATE TYPE "public"."bg_col" AS ENUM('primary', 'secondary', 'accent', 'accent-2');
  CREATE TYPE "public"."img_mode" AS ENUM('background', 'normal');
  CREATE TYPE "public"."img_pos" AS ENUM('above', 'below');
  CREATE TYPE "public"."bg_pos" AS ENUM('center', 'bottom-right', 'bottom-left', 'top-right', 'top-left');
  CREATE TYPE "public"."link_type" AS ENUM('arrow', 'text');
  CREATE TYPE "public"."arrow_col" AS ENUM('primary', 'secondary', 'accent', 'accent-2');
  CREATE TYPE "public"."arrow_bg" AS ENUM('primary', 'secondary', 'accent', 'accent-2');
  CREATE TYPE "public"."enum__pages_v_blocks_content_columns_image_position" AS ENUM('top', 'left', 'right', 'bottom');
  CREATE TYPE "public"."enum__pages_v_blocks_content_columns_image_size" AS ENUM('content', 'wide', 'full');
  CREATE TYPE "public"."enum__pages_v_blocks_layout_block_background" AS ENUM('primary', 'secondary', 'accent', 'accent-2');
  CREATE TYPE "public"."enum__pages_v_blocks_layout_block_width" AS ENUM('full', 'two-thirds', 'half', 'third');
  CREATE TYPE "public"."enum__pages_v_blocks_layout_block_accent" AS ENUM('none', 'left', 'right');
  CREATE TYPE "public"."enum__pages_v_blocks_newsletter_block_background" AS ENUM('primary', 'secondary', 'accent', 'accent-2');
  CREATE TYPE "public"."enum__pages_v_blocks_newsletter_block_textcolor" AS ENUM('primary', 'secondary', 'accent', 'accent-2');
  CREATE TABLE "pages_blocks_layout_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"background" "enum_pages_blocks_layout_block_background" DEFAULT 'primary',
  	"width" "enum_pages_blocks_layout_block_width" DEFAULT 'full',
  	"accent" "enum_pages_blocks_layout_block_accent" DEFAULT 'none',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_newsletter_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"full_width" boolean DEFAULT false,
  	"background" "enum_pages_blocks_newsletter_block_background" DEFAULT 'primary',
  	"textcolor" "enum_pages_blocks_newsletter_block_textcolor" DEFAULT 'accent',
  	"text" jsonb,
  	"form_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_search_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_benefits_block_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"subtitle" varchar,
  	"text_color" text_col DEFAULT 'primary',
  	"background_color" "bg_col" DEFAULT 'primary',
  	"image_mode" "img_mode" DEFAULT 'background',
  	"image_position_normal" "img_pos",
  	"image_position_background" "bg_pos",
  	"image_id" integer,
  	"show_button" boolean DEFAULT false,
  	"link_type" "link_type" DEFAULT 'arrow',
  	"link_text" varchar,
  	"arrow_color" "arrow_col" DEFAULT 'primary',
  	"arrow_bg_color" "arrow_bg" DEFAULT 'primary'
  );
  
  CREATE TABLE "pages_blocks_benefits_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_layout_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"background" "enum__pages_v_blocks_layout_block_background" DEFAULT 'primary',
  	"width" "enum__pages_v_blocks_layout_block_width" DEFAULT 'full',
  	"accent" "enum__pages_v_blocks_layout_block_accent" DEFAULT 'none',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_newsletter_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"full_width" boolean DEFAULT false,
  	"background" "enum__pages_v_blocks_newsletter_block_background" DEFAULT 'primary',
  	"textcolor" "enum__pages_v_blocks_newsletter_block_textcolor" DEFAULT 'accent',
  	"text" jsonb,
  	"form_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_search_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_benefits_block_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"subtitle" varchar,
  	"text_color" text_col DEFAULT 'primary',
  	"background_color" "bg_col" DEFAULT 'primary',
  	"image_mode" "img_mode" DEFAULT 'background',
  	"image_position_normal" "img_pos",
  	"image_position_background" "bg_pos",
  	"image_id" integer,
  	"show_button" boolean DEFAULT false,
  	"link_type" "link_type" DEFAULT 'arrow',
  	"link_text" varchar,
  	"arrow_color" "arrow_col" DEFAULT 'primary',
  	"arrow_bg_color" "arrow_bg" DEFAULT 'primary',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_benefits_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "pages_blocks_content_columns" ADD COLUMN "image_id" integer;
  ALTER TABLE "pages_blocks_content_columns" ADD COLUMN "image_position" "enum_pages_blocks_content_columns_image_position" DEFAULT 'top';
  ALTER TABLE "pages_blocks_content_columns" ADD COLUMN "image_size" "enum_pages_blocks_content_columns_image_size" DEFAULT 'content';
  ALTER TABLE "pages_blocks_content_columns" ADD COLUMN "caption" varchar;
  ALTER TABLE "_pages_v_blocks_content_columns" ADD COLUMN "image_id" integer;
  ALTER TABLE "_pages_v_blocks_content_columns" ADD COLUMN "image_position" "enum__pages_v_blocks_content_columns_image_position" DEFAULT 'top';
  ALTER TABLE "_pages_v_blocks_content_columns" ADD COLUMN "image_size" "enum__pages_v_blocks_content_columns_image_size" DEFAULT 'content';
  ALTER TABLE "_pages_v_blocks_content_columns" ADD COLUMN "caption" varchar;
  ALTER TABLE "pages_blocks_layout_block" ADD CONSTRAINT "pages_blocks_layout_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_newsletter_block" ADD CONSTRAINT "pages_blocks_newsletter_block_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_newsletter_block" ADD CONSTRAINT "pages_blocks_newsletter_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_search_block" ADD CONSTRAINT "pages_blocks_search_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_benefits_block_cards" ADD CONSTRAINT "pages_blocks_benefits_block_cards_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_benefits_block_cards" ADD CONSTRAINT "pages_blocks_benefits_block_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_benefits_block"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_benefits_block" ADD CONSTRAINT "pages_blocks_benefits_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_layout_block" ADD CONSTRAINT "_pages_v_blocks_layout_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_newsletter_block" ADD CONSTRAINT "_pages_v_blocks_newsletter_block_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_newsletter_block" ADD CONSTRAINT "_pages_v_blocks_newsletter_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_search_block" ADD CONSTRAINT "_pages_v_blocks_search_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_benefits_block_cards" ADD CONSTRAINT "_pages_v_blocks_benefits_block_cards_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_benefits_block_cards" ADD CONSTRAINT "_pages_v_blocks_benefits_block_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_benefits_block"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_benefits_block" ADD CONSTRAINT "_pages_v_blocks_benefits_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_layout_block_order_idx" ON "pages_blocks_layout_block" USING btree ("_order");
  CREATE INDEX "pages_blocks_layout_block_parent_id_idx" ON "pages_blocks_layout_block" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_layout_block_path_idx" ON "pages_blocks_layout_block" USING btree ("_path");
  CREATE INDEX "pages_blocks_newsletter_block_order_idx" ON "pages_blocks_newsletter_block" USING btree ("_order");
  CREATE INDEX "pages_blocks_newsletter_block_parent_id_idx" ON "pages_blocks_newsletter_block" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_newsletter_block_path_idx" ON "pages_blocks_newsletter_block" USING btree ("_path");
  CREATE INDEX "pages_blocks_newsletter_block_form_idx" ON "pages_blocks_newsletter_block" USING btree ("form_id");
  CREATE INDEX "pages_blocks_search_block_order_idx" ON "pages_blocks_search_block" USING btree ("_order");
  CREATE INDEX "pages_blocks_search_block_parent_id_idx" ON "pages_blocks_search_block" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_search_block_path_idx" ON "pages_blocks_search_block" USING btree ("_path");
  CREATE INDEX "pages_blocks_benefits_block_cards_order_idx" ON "pages_blocks_benefits_block_cards" USING btree ("_order");
  CREATE INDEX "pages_blocks_benefits_block_cards_parent_id_idx" ON "pages_blocks_benefits_block_cards" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_benefits_block_cards_image_idx" ON "pages_blocks_benefits_block_cards" USING btree ("image_id");
  CREATE INDEX "pages_blocks_benefits_block_order_idx" ON "pages_blocks_benefits_block" USING btree ("_order");
  CREATE INDEX "pages_blocks_benefits_block_parent_id_idx" ON "pages_blocks_benefits_block" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_benefits_block_path_idx" ON "pages_blocks_benefits_block" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_layout_block_order_idx" ON "_pages_v_blocks_layout_block" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_layout_block_parent_id_idx" ON "_pages_v_blocks_layout_block" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_layout_block_path_idx" ON "_pages_v_blocks_layout_block" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_newsletter_block_order_idx" ON "_pages_v_blocks_newsletter_block" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_newsletter_block_parent_id_idx" ON "_pages_v_blocks_newsletter_block" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_newsletter_block_path_idx" ON "_pages_v_blocks_newsletter_block" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_newsletter_block_form_idx" ON "_pages_v_blocks_newsletter_block" USING btree ("form_id");
  CREATE INDEX "_pages_v_blocks_search_block_order_idx" ON "_pages_v_blocks_search_block" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_search_block_parent_id_idx" ON "_pages_v_blocks_search_block" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_search_block_path_idx" ON "_pages_v_blocks_search_block" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_benefits_block_cards_order_idx" ON "_pages_v_blocks_benefits_block_cards" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_benefits_block_cards_parent_id_idx" ON "_pages_v_blocks_benefits_block_cards" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_benefits_block_cards_image_idx" ON "_pages_v_blocks_benefits_block_cards" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_benefits_block_order_idx" ON "_pages_v_blocks_benefits_block" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_benefits_block_parent_id_idx" ON "_pages_v_blocks_benefits_block" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_benefits_block_path_idx" ON "_pages_v_blocks_benefits_block" USING btree ("_path");
  ALTER TABLE "pages_blocks_content_columns" ADD CONSTRAINT "pages_blocks_content_columns_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_content_columns" ADD CONSTRAINT "_pages_v_blocks_content_columns_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pages_blocks_content_columns_image_idx" ON "pages_blocks_content_columns" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_content_columns_image_idx" ON "_pages_v_blocks_content_columns" USING btree ("image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_layout_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_newsletter_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_search_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_benefits_block_cards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_benefits_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_layout_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_newsletter_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_search_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_benefits_block_cards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_benefits_block" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_layout_block" CASCADE;
  DROP TABLE "pages_blocks_newsletter_block" CASCADE;
  DROP TABLE "pages_blocks_search_block" CASCADE;
  DROP TABLE "pages_blocks_benefits_block_cards" CASCADE;
  DROP TABLE "pages_blocks_benefits_block" CASCADE;
  DROP TABLE "_pages_v_blocks_layout_block" CASCADE;
  DROP TABLE "_pages_v_blocks_newsletter_block" CASCADE;
  DROP TABLE "_pages_v_blocks_search_block" CASCADE;
  DROP TABLE "_pages_v_blocks_benefits_block_cards" CASCADE;
  DROP TABLE "_pages_v_blocks_benefits_block" CASCADE;
  ALTER TABLE "pages_blocks_content_columns" DROP CONSTRAINT "pages_blocks_content_columns_image_id_media_id_fk";
  
  ALTER TABLE "_pages_v_blocks_content_columns" DROP CONSTRAINT "_pages_v_blocks_content_columns_image_id_media_id_fk";
  
  DROP INDEX "pages_blocks_content_columns_image_idx";
  DROP INDEX "_pages_v_blocks_content_columns_image_idx";
  ALTER TABLE "pages_blocks_content_columns" DROP COLUMN "image_id";
  ALTER TABLE "pages_blocks_content_columns" DROP COLUMN "image_position";
  ALTER TABLE "pages_blocks_content_columns" DROP COLUMN "image_size";
  ALTER TABLE "pages_blocks_content_columns" DROP COLUMN "caption";
  ALTER TABLE "_pages_v_blocks_content_columns" DROP COLUMN "image_id";
  ALTER TABLE "_pages_v_blocks_content_columns" DROP COLUMN "image_position";
  ALTER TABLE "_pages_v_blocks_content_columns" DROP COLUMN "image_size";
  ALTER TABLE "_pages_v_blocks_content_columns" DROP COLUMN "caption";
  DROP TYPE "public"."enum_pages_blocks_content_columns_image_position";
  DROP TYPE "public"."enum_pages_blocks_content_columns_image_size";
  DROP TYPE "public"."enum_pages_blocks_layout_block_background";
  DROP TYPE "public"."enum_pages_blocks_layout_block_width";
  DROP TYPE "public"."enum_pages_blocks_layout_block_accent";
  DROP TYPE "public"."enum_pages_blocks_newsletter_block_background";
  DROP TYPE "public"."enum_pages_blocks_newsletter_block_textcolor";
  DROP TYPE "public"."text_col";
  DROP TYPE "public"."bg_col";
  DROP TYPE "public"."img_mode";
  DROP TYPE "public"."img_pos";
  DROP TYPE "public"."bg_pos";
  DROP TYPE "public"."link_type";
  DROP TYPE "public"."arrow_col";
  DROP TYPE "public"."arrow_bg";
  DROP TYPE "public"."enum__pages_v_blocks_content_columns_image_position";
  DROP TYPE "public"."enum__pages_v_blocks_content_columns_image_size";
  DROP TYPE "public"."enum__pages_v_blocks_layout_block_background";
  DROP TYPE "public"."enum__pages_v_blocks_layout_block_width";
  DROP TYPE "public"."enum__pages_v_blocks_layout_block_accent";
  DROP TYPE "public"."enum__pages_v_blocks_newsletter_block_background";
  DROP TYPE "public"."enum__pages_v_blocks_newsletter_block_textcolor";`)
}
