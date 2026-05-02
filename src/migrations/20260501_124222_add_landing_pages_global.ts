import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_landing_pages_home_features_items_icon" AS ENUM('checkCircle', 'target', 'trendingUp', 'eye');
  CREATE TYPE "public"."enum_landing_pages_clinic_partners_features_items_icon" AS ENUM('checkCircle', 'target', 'trendingUp', 'eye');
  CREATE TYPE "public"."enum_landing_pages_clinic_partners_team_photo_display" AS ENUM('original', 'grayscale');
  CREATE TYPE "public"."enum_landing_pages_clinic_partners_pricing_plans_layout" AS ENUM('primary', 'compact');
  CREATE TYPE "public"."enum_landing_pages_clinic_partners_cta_link_type" AS ENUM('reference', 'custom');
  CREATE TABLE "landing_pages_home_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"quote" varchar NOT NULL,
  	"author" varchar NOT NULL,
  	"role" varchar NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "landing_pages_home_features_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"subtitle" varchar,
  	"description" varchar NOT NULL,
  	"icon" "enum_landing_pages_home_features_items_icon" NOT NULL
  );
  
  CREATE TABLE "landing_pages_home_process_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"step" numeric NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "landing_pages_home_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL
  );
  
  CREATE TABLE "landing_pages_clinic_partners_features_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"subtitle" varchar,
  	"description" varchar NOT NULL,
  	"icon" "enum_landing_pages_clinic_partners_features_items_icon" NOT NULL
  );
  
  CREATE TABLE "landing_pages_clinic_partners_process_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"step" numeric NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "landing_pages_clinic_partners_team" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" varchar NOT NULL,
  	"image_id" integer NOT NULL,
  	"is_photo" boolean DEFAULT true,
  	"photo_display" "enum_landing_pages_clinic_partners_team_photo_display" DEFAULT 'grayscale',
  	"socials_meta" varchar,
  	"socials_x" varchar,
  	"socials_instagram" varchar,
  	"socials_linkedin" varchar,
  	"socials_github" varchar
  );
  
  CREATE TABLE "landing_pages_clinic_partners_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"quote" varchar NOT NULL,
  	"author" varchar NOT NULL,
  	"role" varchar NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "landing_pages_clinic_partners_pricing_plans_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "landing_pages_clinic_partners_pricing_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"price" varchar NOT NULL,
  	"billing_label" varchar,
  	"plan" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"button_text" varchar NOT NULL,
  	"badge" varchar,
  	"layout" "enum_landing_pages_clinic_partners_pricing_plans_layout" DEFAULT 'primary' NOT NULL
  );
  
  CREATE TABLE "landing_pages_clinic_partners_pricing_model" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL
  );
  
  CREATE TABLE "landing_pages_clinic_partners_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL
  );
  
  CREATE TABLE "landing_pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"home_seo_title" varchar NOT NULL,
  	"home_seo_description" varchar NOT NULL,
  	"home_hero_title" varchar NOT NULL,
  	"home_hero_description" varchar NOT NULL,
  	"home_hero_image_id" integer NOT NULL,
  	"home_categories_intro_title" varchar NOT NULL,
  	"home_categories_intro_description" varchar NOT NULL,
  	"home_features_title" varchar NOT NULL,
  	"home_features_description" varchar NOT NULL,
  	"home_features_background_image_id" integer NOT NULL,
  	"home_process_title" varchar NOT NULL,
  	"home_process_subtitle" varchar NOT NULL,
  	"home_faq_title" varchar NOT NULL,
  	"home_faq_description" varchar NOT NULL,
  	"home_blog_teaser_title" varchar NOT NULL,
  	"home_blog_teaser_description" varchar NOT NULL,
  	"home_contact_title" varchar NOT NULL,
  	"home_contact_description" varchar NOT NULL,
  	"clinic_partners_seo_title" varchar NOT NULL,
  	"clinic_partners_seo_description" varchar NOT NULL,
  	"clinic_partners_hero_title" varchar NOT NULL,
  	"clinic_partners_hero_description" varchar NOT NULL,
  	"clinic_partners_hero_image_id" integer NOT NULL,
  	"clinic_partners_features_title" varchar NOT NULL,
  	"clinic_partners_features_description" varchar NOT NULL,
  	"clinic_partners_process_title" varchar NOT NULL,
  	"clinic_partners_process_subtitle" varchar NOT NULL,
  	"clinic_partners_categories_intro_title" varchar NOT NULL,
  	"clinic_partners_categories_intro_description" varchar NOT NULL,
  	"clinic_partners_cta_title" varchar NOT NULL,
  	"clinic_partners_cta_button_text" varchar NOT NULL,
  	"clinic_partners_cta_link_type" "enum_landing_pages_clinic_partners_cta_link_type" DEFAULT 'reference',
  	"clinic_partners_cta_link_new_tab" boolean,
  	"clinic_partners_cta_link_url" varchar,
  	"clinic_partners_pricing_title" varchar NOT NULL,
  	"clinic_partners_pricing_description" varchar NOT NULL,
  	"clinic_partners_faq_title" varchar NOT NULL,
  	"clinic_partners_faq_description" varchar NOT NULL,
  	"clinic_partners_blog_teaser_title" varchar NOT NULL,
  	"clinic_partners_blog_teaser_description" varchar NOT NULL,
  	"clinic_partners_contact_title" varchar NOT NULL,
  	"clinic_partners_contact_description" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "landing_pages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"posts_id" integer
  );
  
  ALTER TABLE "landing_pages_home_testimonials" ADD CONSTRAINT "landing_pages_home_testimonials_image_id_platform_content_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "landing_pages_home_testimonials" ADD CONSTRAINT "landing_pages_home_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_home_features_items" ADD CONSTRAINT "landing_pages_home_features_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_home_process_steps" ADD CONSTRAINT "landing_pages_home_process_steps_image_id_platform_content_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "landing_pages_home_process_steps" ADD CONSTRAINT "landing_pages_home_process_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_home_faq_items" ADD CONSTRAINT "landing_pages_home_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_clinic_partners_features_items" ADD CONSTRAINT "landing_pages_clinic_partners_features_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_clinic_partners_process_steps" ADD CONSTRAINT "landing_pages_clinic_partners_process_steps_image_id_platform_content_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "landing_pages_clinic_partners_process_steps" ADD CONSTRAINT "landing_pages_clinic_partners_process_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_clinic_partners_team" ADD CONSTRAINT "landing_pages_clinic_partners_team_image_id_platform_content_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "landing_pages_clinic_partners_team" ADD CONSTRAINT "landing_pages_clinic_partners_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_clinic_partners_testimonials" ADD CONSTRAINT "landing_pages_clinic_partners_testimonials_image_id_platform_content_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "landing_pages_clinic_partners_testimonials" ADD CONSTRAINT "landing_pages_clinic_partners_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_clinic_partners_pricing_plans_highlights" ADD CONSTRAINT "landing_pages_clinic_partners_pricing_plans_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages_clinic_partners_pricing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_clinic_partners_pricing_plans" ADD CONSTRAINT "landing_pages_clinic_partners_pricing_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_clinic_partners_pricing_model" ADD CONSTRAINT "landing_pages_clinic_partners_pricing_model_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_clinic_partners_faq_items" ADD CONSTRAINT "landing_pages_clinic_partners_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_home_hero_image_id_platform_content_media_id_fk" FOREIGN KEY ("home_hero_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_home_features_background_image_id_platform_content_media_id_fk" FOREIGN KEY ("home_features_background_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_clinic_partners_hero_image_id_platform_content_media_id_fk" FOREIGN KEY ("clinic_partners_hero_image_id") REFERENCES "public"."platform_content_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "landing_pages_rels" ADD CONSTRAINT "landing_pages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_rels" ADD CONSTRAINT "landing_pages_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_rels" ADD CONSTRAINT "landing_pages_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "landing_pages_home_testimonials_order_idx" ON "landing_pages_home_testimonials" USING btree ("_order");
  CREATE INDEX "landing_pages_home_testimonials_parent_id_idx" ON "landing_pages_home_testimonials" USING btree ("_parent_id");
  CREATE INDEX "landing_pages_home_testimonials_image_idx" ON "landing_pages_home_testimonials" USING btree ("image_id");
  CREATE INDEX "landing_pages_home_features_items_order_idx" ON "landing_pages_home_features_items" USING btree ("_order");
  CREATE INDEX "landing_pages_home_features_items_parent_id_idx" ON "landing_pages_home_features_items" USING btree ("_parent_id");
  CREATE INDEX "landing_pages_home_process_steps_order_idx" ON "landing_pages_home_process_steps" USING btree ("_order");
  CREATE INDEX "landing_pages_home_process_steps_parent_id_idx" ON "landing_pages_home_process_steps" USING btree ("_parent_id");
  CREATE INDEX "landing_pages_home_process_steps_image_idx" ON "landing_pages_home_process_steps" USING btree ("image_id");
  CREATE INDEX "landing_pages_home_faq_items_order_idx" ON "landing_pages_home_faq_items" USING btree ("_order");
  CREATE INDEX "landing_pages_home_faq_items_parent_id_idx" ON "landing_pages_home_faq_items" USING btree ("_parent_id");
  CREATE INDEX "landing_pages_clinic_partners_features_items_order_idx" ON "landing_pages_clinic_partners_features_items" USING btree ("_order");
  CREATE INDEX "landing_pages_clinic_partners_features_items_parent_id_idx" ON "landing_pages_clinic_partners_features_items" USING btree ("_parent_id");
  CREATE INDEX "landing_pages_clinic_partners_process_steps_order_idx" ON "landing_pages_clinic_partners_process_steps" USING btree ("_order");
  CREATE INDEX "landing_pages_clinic_partners_process_steps_parent_id_idx" ON "landing_pages_clinic_partners_process_steps" USING btree ("_parent_id");
  CREATE INDEX "landing_pages_clinic_partners_process_steps_image_idx" ON "landing_pages_clinic_partners_process_steps" USING btree ("image_id");
  CREATE INDEX "landing_pages_clinic_partners_team_order_idx" ON "landing_pages_clinic_partners_team" USING btree ("_order");
  CREATE INDEX "landing_pages_clinic_partners_team_parent_id_idx" ON "landing_pages_clinic_partners_team" USING btree ("_parent_id");
  CREATE INDEX "landing_pages_clinic_partners_team_image_idx" ON "landing_pages_clinic_partners_team" USING btree ("image_id");
  CREATE INDEX "landing_pages_clinic_partners_testimonials_order_idx" ON "landing_pages_clinic_partners_testimonials" USING btree ("_order");
  CREATE INDEX "landing_pages_clinic_partners_testimonials_parent_id_idx" ON "landing_pages_clinic_partners_testimonials" USING btree ("_parent_id");
  CREATE INDEX "landing_pages_clinic_partners_testimonials_image_idx" ON "landing_pages_clinic_partners_testimonials" USING btree ("image_id");
  CREATE INDEX "landing_pages_clinic_partners_pricing_plans_highlights_order_idx" ON "landing_pages_clinic_partners_pricing_plans_highlights" USING btree ("_order");
  CREATE INDEX "landing_pages_clinic_partners_pricing_plans_highlights_parent_id_idx" ON "landing_pages_clinic_partners_pricing_plans_highlights" USING btree ("_parent_id");
  CREATE INDEX "landing_pages_clinic_partners_pricing_plans_order_idx" ON "landing_pages_clinic_partners_pricing_plans" USING btree ("_order");
  CREATE INDEX "landing_pages_clinic_partners_pricing_plans_parent_id_idx" ON "landing_pages_clinic_partners_pricing_plans" USING btree ("_parent_id");
  CREATE INDEX "landing_pages_clinic_partners_pricing_model_order_idx" ON "landing_pages_clinic_partners_pricing_model" USING btree ("_order");
  CREATE INDEX "landing_pages_clinic_partners_pricing_model_parent_id_idx" ON "landing_pages_clinic_partners_pricing_model" USING btree ("_parent_id");
  CREATE INDEX "landing_pages_clinic_partners_faq_items_order_idx" ON "landing_pages_clinic_partners_faq_items" USING btree ("_order");
  CREATE INDEX "landing_pages_clinic_partners_faq_items_parent_id_idx" ON "landing_pages_clinic_partners_faq_items" USING btree ("_parent_id");
  CREATE INDEX "landing_pages_home_hero_home_hero_image_idx" ON "landing_pages" USING btree ("home_hero_image_id");
  CREATE INDEX "landing_pages_home_features_home_features_background_ima_idx" ON "landing_pages" USING btree ("home_features_background_image_id");
  CREATE INDEX "landing_pages_clinic_partners_hero_clinic_partners_hero__idx" ON "landing_pages" USING btree ("clinic_partners_hero_image_id");
  CREATE INDEX "landing_pages_rels_order_idx" ON "landing_pages_rels" USING btree ("order");
  CREATE INDEX "landing_pages_rels_parent_idx" ON "landing_pages_rels" USING btree ("parent_id");
  CREATE INDEX "landing_pages_rels_path_idx" ON "landing_pages_rels" USING btree ("path");
  CREATE INDEX "landing_pages_rels_pages_id_idx" ON "landing_pages_rels" USING btree ("pages_id");
  CREATE INDEX "landing_pages_rels_posts_id_idx" ON "landing_pages_rels" USING btree ("posts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "landing_pages_home_testimonials" CASCADE;
  DROP TABLE "landing_pages_home_features_items" CASCADE;
  DROP TABLE "landing_pages_home_process_steps" CASCADE;
  DROP TABLE "landing_pages_home_faq_items" CASCADE;
  DROP TABLE "landing_pages_clinic_partners_features_items" CASCADE;
  DROP TABLE "landing_pages_clinic_partners_process_steps" CASCADE;
  DROP TABLE "landing_pages_clinic_partners_team" CASCADE;
  DROP TABLE "landing_pages_clinic_partners_testimonials" CASCADE;
  DROP TABLE "landing_pages_clinic_partners_pricing_plans_highlights" CASCADE;
  DROP TABLE "landing_pages_clinic_partners_pricing_plans" CASCADE;
  DROP TABLE "landing_pages_clinic_partners_pricing_model" CASCADE;
  DROP TABLE "landing_pages_clinic_partners_faq_items" CASCADE;
  DROP TABLE "landing_pages" CASCADE;
  DROP TABLE "landing_pages_rels" CASCADE;
  DROP TYPE "public"."enum_landing_pages_home_features_items_icon";
  DROP TYPE "public"."enum_landing_pages_clinic_partners_features_items_icon";
  DROP TYPE "public"."enum_landing_pages_clinic_partners_team_photo_display";
  DROP TYPE "public"."enum_landing_pages_clinic_partners_pricing_plans_layout";
  DROP TYPE "public"."enum_landing_pages_clinic_partners_cta_link_type";`)
}
