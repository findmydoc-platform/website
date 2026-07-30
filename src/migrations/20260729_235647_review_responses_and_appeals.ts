import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_review_responses_moderation_status" AS ENUM('pending', 'approved', 'rejected', 'blocked');
  CREATE TYPE "public"."enum_review_responses_last_action" AS ENUM('submitted', 'pending_edited', 'revision_submitted', 'approved', 'rejected', 'blocked', 'seeded');
  CREATE TYPE "public"."enum_review_responses_last_actor_type" AS ENUM('clinic_staff', 'platform_staff', 'system');
  CREATE TYPE "public"."enum__review_responses_v_version_moderation_status" AS ENUM('pending', 'approved', 'rejected', 'blocked');
  CREATE TYPE "public"."enum__review_responses_v_version_last_action" AS ENUM('submitted', 'pending_edited', 'revision_submitted', 'approved', 'rejected', 'blocked', 'seeded');
  CREATE TYPE "public"."enum__review_responses_v_version_last_actor_type" AS ENUM('clinic_staff', 'platform_staff', 'system');
  CREATE TYPE "public"."enum_review_appeals_reason" AS ENUM('incorrect_clinic', 'inappropriate_content', 'privacy_concern', 'other');
  CREATE TYPE "public"."enum_review_appeals_status" AS ENUM('submitted', 'under_review', 'upheld', 'dismissed');
  CREATE TYPE "public"."enum_review_appeals_last_action" AS ENUM('submitted', 'reviewed', 'under_review', 'upheld', 'dismissed', 'seeded');
  CREATE TYPE "public"."enum_review_appeals_last_actor_type" AS ENUM('clinic_staff', 'platform_staff', 'system');
  CREATE TYPE "public"."enum__review_appeals_v_version_reason" AS ENUM('incorrect_clinic', 'inappropriate_content', 'privacy_concern', 'other');
  CREATE TYPE "public"."enum__review_appeals_v_version_status" AS ENUM('submitted', 'under_review', 'upheld', 'dismissed');
  CREATE TYPE "public"."enum__review_appeals_v_version_last_action" AS ENUM('submitted', 'reviewed', 'under_review', 'upheld', 'dismissed', 'seeded');
  CREATE TYPE "public"."enum__review_appeals_v_version_last_actor_type" AS ENUM('clinic_staff', 'platform_staff', 'system');
  CREATE TABLE "review_responses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stable_id" varchar,
  	"review_id" integer NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"published_response_body" varchar,
  	"published_response_approved_at" timestamp(3) with time zone,
  	"published_response_is_blocked" boolean DEFAULT false,
  	"pending_response_body" varchar,
  	"pending_response_submitted_at" timestamp(3) with time zone,
  	"moderation_status" "enum_review_responses_moderation_status" DEFAULT 'pending' NOT NULL,
  	"moderation_reason" varchar,
  	"moderated_at" timestamp(3) with time zone,
  	"last_action" "enum_review_responses_last_action" NOT NULL,
  	"last_action_at" timestamp(3) with time zone NOT NULL,
  	"last_actor_type" "enum_review_responses_last_actor_type" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "review_responses_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"platform_staff_id" integer,
  	"clinic_staff_id" integer
  );
  
  CREATE TABLE "_review_responses_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_stable_id" varchar,
  	"version_review_id" integer NOT NULL,
  	"version_clinic_id" integer NOT NULL,
  	"version_published_response_body" varchar,
  	"version_published_response_approved_at" timestamp(3) with time zone,
  	"version_published_response_is_blocked" boolean DEFAULT false,
  	"version_pending_response_body" varchar,
  	"version_pending_response_submitted_at" timestamp(3) with time zone,
  	"version_moderation_status" "enum__review_responses_v_version_moderation_status" DEFAULT 'pending' NOT NULL,
  	"version_moderation_reason" varchar,
  	"version_moderated_at" timestamp(3) with time zone,
  	"version_last_action" "enum__review_responses_v_version_last_action" NOT NULL,
  	"version_last_action_at" timestamp(3) with time zone NOT NULL,
  	"version_last_actor_type" "enum__review_responses_v_version_last_actor_type" NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_review_responses_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"platform_staff_id" integer,
  	"clinic_staff_id" integer
  );
  
  CREATE TABLE "review_appeals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stable_id" varchar,
  	"review_id" integer NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"reason" "enum_review_appeals_reason" NOT NULL,
  	"details" varchar NOT NULL,
  	"status" "enum_review_appeals_status" DEFAULT 'submitted' NOT NULL,
  	"decision_reason" varchar,
  	"decided_at" timestamp(3) with time zone,
  	"last_action" "enum_review_appeals_last_action" NOT NULL,
  	"last_action_at" timestamp(3) with time zone NOT NULL,
  	"last_actor_type" "enum_review_appeals_last_actor_type" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "review_appeals_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"platform_staff_id" integer,
  	"clinic_staff_id" integer
  );
  
  CREATE TABLE "_review_appeals_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_stable_id" varchar,
  	"version_review_id" integer NOT NULL,
  	"version_clinic_id" integer NOT NULL,
  	"version_reason" "enum__review_appeals_v_version_reason" NOT NULL,
  	"version_details" varchar NOT NULL,
  	"version_status" "enum__review_appeals_v_version_status" DEFAULT 'submitted' NOT NULL,
  	"version_decision_reason" varchar,
  	"version_decided_at" timestamp(3) with time zone,
  	"version_last_action" "enum__review_appeals_v_version_last_action" NOT NULL,
  	"version_last_action_at" timestamp(3) with time zone NOT NULL,
  	"version_last_actor_type" "enum__review_appeals_v_version_last_actor_type" NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_review_appeals_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"platform_staff_id" integer,
  	"clinic_staff_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "review_responses_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "review_appeals_id" integer;
  ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "review_responses_rels" ADD CONSTRAINT "review_responses_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."review_responses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "review_responses_rels" ADD CONSTRAINT "review_responses_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "review_responses_rels" ADD CONSTRAINT "review_responses_rels_clinic_staff_fk" FOREIGN KEY ("clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_review_responses_v" ADD CONSTRAINT "_review_responses_v_parent_id_review_responses_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."review_responses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_review_responses_v" ADD CONSTRAINT "_review_responses_v_version_review_id_reviews_id_fk" FOREIGN KEY ("version_review_id") REFERENCES "public"."reviews"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_review_responses_v" ADD CONSTRAINT "_review_responses_v_version_clinic_id_clinics_id_fk" FOREIGN KEY ("version_clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_review_responses_v_rels" ADD CONSTRAINT "_review_responses_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_review_responses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_review_responses_v_rels" ADD CONSTRAINT "_review_responses_v_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_review_responses_v_rels" ADD CONSTRAINT "_review_responses_v_rels_clinic_staff_fk" FOREIGN KEY ("clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "review_appeals" ADD CONSTRAINT "review_appeals_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "review_appeals" ADD CONSTRAINT "review_appeals_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "review_appeals_rels" ADD CONSTRAINT "review_appeals_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."review_appeals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "review_appeals_rels" ADD CONSTRAINT "review_appeals_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "review_appeals_rels" ADD CONSTRAINT "review_appeals_rels_clinic_staff_fk" FOREIGN KEY ("clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_review_appeals_v" ADD CONSTRAINT "_review_appeals_v_parent_id_review_appeals_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."review_appeals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_review_appeals_v" ADD CONSTRAINT "_review_appeals_v_version_review_id_reviews_id_fk" FOREIGN KEY ("version_review_id") REFERENCES "public"."reviews"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_review_appeals_v" ADD CONSTRAINT "_review_appeals_v_version_clinic_id_clinics_id_fk" FOREIGN KEY ("version_clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_review_appeals_v_rels" ADD CONSTRAINT "_review_appeals_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_review_appeals_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_review_appeals_v_rels" ADD CONSTRAINT "_review_appeals_v_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_review_appeals_v_rels" ADD CONSTRAINT "_review_appeals_v_rels_clinic_staff_fk" FOREIGN KEY ("clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "review_responses_stable_id_idx" ON "review_responses" USING btree ("stable_id");
  CREATE UNIQUE INDEX "review_responses_review_idx" ON "review_responses" USING btree ("review_id");
  CREATE INDEX "review_responses_clinic_idx" ON "review_responses" USING btree ("clinic_id");
  CREATE INDEX "review_responses_moderation_status_idx" ON "review_responses" USING btree ("moderation_status");
  CREATE INDEX "review_responses_updated_at_idx" ON "review_responses" USING btree ("updated_at");
  CREATE INDEX "review_responses_created_at_idx" ON "review_responses" USING btree ("created_at");
  CREATE INDEX "review_responses_rels_order_idx" ON "review_responses_rels" USING btree ("order");
  CREATE INDEX "review_responses_rels_parent_idx" ON "review_responses_rels" USING btree ("parent_id");
  CREATE INDEX "review_responses_rels_path_idx" ON "review_responses_rels" USING btree ("path");
  CREATE INDEX "review_responses_rels_platform_staff_id_idx" ON "review_responses_rels" USING btree ("platform_staff_id");
  CREATE INDEX "review_responses_rels_clinic_staff_id_idx" ON "review_responses_rels" USING btree ("clinic_staff_id");
  CREATE INDEX "_review_responses_v_parent_idx" ON "_review_responses_v" USING btree ("parent_id");
  CREATE INDEX "_review_responses_v_version_version_stable_id_idx" ON "_review_responses_v" USING btree ("version_stable_id");
  CREATE INDEX "_review_responses_v_version_version_review_idx" ON "_review_responses_v" USING btree ("version_review_id");
  CREATE INDEX "_review_responses_v_version_version_clinic_idx" ON "_review_responses_v" USING btree ("version_clinic_id");
  CREATE INDEX "_review_responses_v_version_version_moderation_status_idx" ON "_review_responses_v" USING btree ("version_moderation_status");
  CREATE INDEX "_review_responses_v_version_version_updated_at_idx" ON "_review_responses_v" USING btree ("version_updated_at");
  CREATE INDEX "_review_responses_v_version_version_created_at_idx" ON "_review_responses_v" USING btree ("version_created_at");
  CREATE INDEX "_review_responses_v_created_at_idx" ON "_review_responses_v" USING btree ("created_at");
  CREATE INDEX "_review_responses_v_updated_at_idx" ON "_review_responses_v" USING btree ("updated_at");
  CREATE INDEX "_review_responses_v_rels_order_idx" ON "_review_responses_v_rels" USING btree ("order");
  CREATE INDEX "_review_responses_v_rels_parent_idx" ON "_review_responses_v_rels" USING btree ("parent_id");
  CREATE INDEX "_review_responses_v_rels_path_idx" ON "_review_responses_v_rels" USING btree ("path");
  CREATE INDEX "_review_responses_v_rels_platform_staff_id_idx" ON "_review_responses_v_rels" USING btree ("platform_staff_id");
  CREATE INDEX "_review_responses_v_rels_clinic_staff_id_idx" ON "_review_responses_v_rels" USING btree ("clinic_staff_id");
  CREATE UNIQUE INDEX "review_appeals_stable_id_idx" ON "review_appeals" USING btree ("stable_id");
  CREATE UNIQUE INDEX "review_appeals_review_idx" ON "review_appeals" USING btree ("review_id");
  CREATE INDEX "review_appeals_clinic_idx" ON "review_appeals" USING btree ("clinic_id");
  CREATE INDEX "review_appeals_status_idx" ON "review_appeals" USING btree ("status");
  CREATE INDEX "review_appeals_updated_at_idx" ON "review_appeals" USING btree ("updated_at");
  CREATE INDEX "review_appeals_created_at_idx" ON "review_appeals" USING btree ("created_at");
  CREATE INDEX "review_appeals_rels_order_idx" ON "review_appeals_rels" USING btree ("order");
  CREATE INDEX "review_appeals_rels_parent_idx" ON "review_appeals_rels" USING btree ("parent_id");
  CREATE INDEX "review_appeals_rels_path_idx" ON "review_appeals_rels" USING btree ("path");
  CREATE INDEX "review_appeals_rels_platform_staff_id_idx" ON "review_appeals_rels" USING btree ("platform_staff_id");
  CREATE INDEX "review_appeals_rels_clinic_staff_id_idx" ON "review_appeals_rels" USING btree ("clinic_staff_id");
  CREATE INDEX "_review_appeals_v_parent_idx" ON "_review_appeals_v" USING btree ("parent_id");
  CREATE INDEX "_review_appeals_v_version_version_stable_id_idx" ON "_review_appeals_v" USING btree ("version_stable_id");
  CREATE INDEX "_review_appeals_v_version_version_review_idx" ON "_review_appeals_v" USING btree ("version_review_id");
  CREATE INDEX "_review_appeals_v_version_version_clinic_idx" ON "_review_appeals_v" USING btree ("version_clinic_id");
  CREATE INDEX "_review_appeals_v_version_version_status_idx" ON "_review_appeals_v" USING btree ("version_status");
  CREATE INDEX "_review_appeals_v_version_version_updated_at_idx" ON "_review_appeals_v" USING btree ("version_updated_at");
  CREATE INDEX "_review_appeals_v_version_version_created_at_idx" ON "_review_appeals_v" USING btree ("version_created_at");
  CREATE INDEX "_review_appeals_v_created_at_idx" ON "_review_appeals_v" USING btree ("created_at");
  CREATE INDEX "_review_appeals_v_updated_at_idx" ON "_review_appeals_v" USING btree ("updated_at");
  CREATE INDEX "_review_appeals_v_rels_order_idx" ON "_review_appeals_v_rels" USING btree ("order");
  CREATE INDEX "_review_appeals_v_rels_parent_idx" ON "_review_appeals_v_rels" USING btree ("parent_id");
  CREATE INDEX "_review_appeals_v_rels_path_idx" ON "_review_appeals_v_rels" USING btree ("path");
  CREATE INDEX "_review_appeals_v_rels_platform_staff_id_idx" ON "_review_appeals_v_rels" USING btree ("platform_staff_id");
  CREATE INDEX "_review_appeals_v_rels_clinic_staff_id_idx" ON "_review_appeals_v_rels" USING btree ("clinic_staff_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_review_responses_fk" FOREIGN KEY ("review_responses_id") REFERENCES "public"."review_responses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_review_appeals_fk" FOREIGN KEY ("review_appeals_id") REFERENCES "public"."review_appeals"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_review_responses_id_idx" ON "payload_locked_documents_rels" USING btree ("review_responses_id");
  CREATE INDEX "payload_locked_documents_rels_review_appeals_id_idx" ON "payload_locked_documents_rels" USING btree ("review_appeals_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "review_responses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "review_responses_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_review_responses_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_review_responses_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "review_appeals" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "review_appeals_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_review_appeals_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_review_appeals_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "review_responses" CASCADE;
  DROP TABLE "review_responses_rels" CASCADE;
  DROP TABLE "_review_responses_v" CASCADE;
  DROP TABLE "_review_responses_v_rels" CASCADE;
  DROP TABLE "review_appeals" CASCADE;
  DROP TABLE "review_appeals_rels" CASCADE;
  DROP TABLE "_review_appeals_v" CASCADE;
  DROP TABLE "_review_appeals_v_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_review_responses_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_review_appeals_fk";
  
  DROP INDEX "payload_locked_documents_rels_review_responses_id_idx";
  DROP INDEX "payload_locked_documents_rels_review_appeals_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "review_responses_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "review_appeals_id";
  DROP TYPE "public"."enum_review_responses_moderation_status";
  DROP TYPE "public"."enum_review_responses_last_action";
  DROP TYPE "public"."enum_review_responses_last_actor_type";
  DROP TYPE "public"."enum__review_responses_v_version_moderation_status";
  DROP TYPE "public"."enum__review_responses_v_version_last_action";
  DROP TYPE "public"."enum__review_responses_v_version_last_actor_type";
  DROP TYPE "public"."enum_review_appeals_reason";
  DROP TYPE "public"."enum_review_appeals_status";
  DROP TYPE "public"."enum_review_appeals_last_action";
  DROP TYPE "public"."enum_review_appeals_last_actor_type";
  DROP TYPE "public"."enum__review_appeals_v_version_reason";
  DROP TYPE "public"."enum__review_appeals_v_version_status";
  DROP TYPE "public"."enum__review_appeals_v_version_last_action";
  DROP TYPE "public"."enum__review_appeals_v_version_last_actor_type";`)
}
