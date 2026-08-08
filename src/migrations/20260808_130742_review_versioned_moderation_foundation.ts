import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_reviews_public_measure" AS ENUM('none', 'context', 'redaction', 'placeholder', 'removed');
  CREATE TYPE "public"."enum_reviews_withdrawal_state" AS ENUM('active', 'withdrawn');
  CREATE TYPE "public"."enum_reviews_withdrawal_source" AS ENUM('patient', 'platform');
  CREATE TYPE "public"."enum__reviews_v_version_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TYPE "public"."enum__reviews_v_version_author_visibility" AS ENUM('anonymous', 'firstNameInitial');
  CREATE TYPE "public"."enum__reviews_v_version_public_measure" AS ENUM('none', 'context', 'redaction', 'placeholder', 'removed');
  CREATE TYPE "public"."enum__reviews_v_version_withdrawal_state" AS ENUM('active', 'withdrawn');
  CREATE TYPE "public"."enum__reviews_v_version_withdrawal_source" AS ENUM('patient', 'platform');
  CREATE TABLE "reviews_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"patients_id" integer,
  	"platform_staff_id" integer
  );
  
  CREATE TABLE "_reviews_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_stable_id" varchar,
  	"version_review_date" timestamp(3) with time zone NOT NULL,
  	"version_patient_id" integer,
  	"version_status" "enum__reviews_v_version_status" DEFAULT 'pending' NOT NULL,
  	"version_author_visibility" "enum__reviews_v_version_author_visibility" DEFAULT 'anonymous' NOT NULL,
  	"version_public_author_name" varchar,
  	"version_star_rating" numeric NOT NULL,
  	"version_comment" varchar NOT NULL,
  	"version_clinic_id" integer NOT NULL,
  	"version_doctor_id" integer NOT NULL,
  	"version_treatment_id" integer NOT NULL,
  	"version_last_edited_at" timestamp(3) with time zone,
  	"version_edited_by_name" varchar,
  	"version_edited_by_id" integer,
  	"version_public_measure" "enum__reviews_v_version_public_measure" DEFAULT 'none' NOT NULL,
  	"version_moderated_at" timestamp(3) with time zone,
  	"version_public_comment" varchar,
  	"version_public_notice" varchar,
  	"version_moderation_reason" varchar,
  	"version_moderated_by_id" integer,
  	"version_withdrawal_state" "enum__reviews_v_version_withdrawal_state" DEFAULT 'active' NOT NULL,
  	"version_withdrawal_source" "enum__reviews_v_version_withdrawal_source",
  	"version_withdrawal_reason" varchar,
  	"version_withdrawn_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_reviews_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"patients_id" integer,
  	"platform_staff_id" integer
  );
  
  ALTER TABLE "reviews" ADD COLUMN "public_measure" "enum_reviews_public_measure" DEFAULT 'none' NOT NULL;
  ALTER TABLE "reviews" ADD COLUMN "moderated_at" timestamp(3) with time zone;
  ALTER TABLE "reviews" ADD COLUMN "public_comment" varchar;
  ALTER TABLE "reviews" ADD COLUMN "public_notice" varchar;
  ALTER TABLE "reviews" ADD COLUMN "moderation_reason" varchar;
  ALTER TABLE "reviews" ADD COLUMN "moderated_by_id" integer;
  ALTER TABLE "reviews" ADD COLUMN "withdrawal_state" "enum_reviews_withdrawal_state" DEFAULT 'active' NOT NULL;
  ALTER TABLE "reviews" ADD COLUMN "withdrawal_source" "enum_reviews_withdrawal_source";
  ALTER TABLE "reviews" ADD COLUMN "withdrawal_reason" varchar;
  ALTER TABLE "reviews" ADD COLUMN "withdrawn_at" timestamp(3) with time zone;
  ALTER TABLE "reviews_rels" ADD CONSTRAINT "reviews_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reviews_rels" ADD CONSTRAINT "reviews_rels_patients_fk" FOREIGN KEY ("patients_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reviews_rels" ADD CONSTRAINT "reviews_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_reviews_v" ADD CONSTRAINT "_reviews_v_parent_id_reviews_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."reviews"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_reviews_v" ADD CONSTRAINT "_reviews_v_version_patient_id_patients_id_fk" FOREIGN KEY ("version_patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_reviews_v" ADD CONSTRAINT "_reviews_v_version_clinic_id_clinics_id_fk" FOREIGN KEY ("version_clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_reviews_v" ADD CONSTRAINT "_reviews_v_version_doctor_id_doctors_id_fk" FOREIGN KEY ("version_doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_reviews_v" ADD CONSTRAINT "_reviews_v_version_treatment_id_treatments_id_fk" FOREIGN KEY ("version_treatment_id") REFERENCES "public"."treatments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_reviews_v" ADD CONSTRAINT "_reviews_v_version_edited_by_id_platform_staff_id_fk" FOREIGN KEY ("version_edited_by_id") REFERENCES "public"."platform_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_reviews_v" ADD CONSTRAINT "_reviews_v_version_moderated_by_id_platform_staff_id_fk" FOREIGN KEY ("version_moderated_by_id") REFERENCES "public"."platform_staff"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_reviews_v_rels" ADD CONSTRAINT "_reviews_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_reviews_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_reviews_v_rels" ADD CONSTRAINT "_reviews_v_rels_patients_fk" FOREIGN KEY ("patients_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_reviews_v_rels" ADD CONSTRAINT "_reviews_v_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "reviews_rels_order_idx" ON "reviews_rels" USING btree ("order");
  CREATE INDEX "reviews_rels_parent_idx" ON "reviews_rels" USING btree ("parent_id");
  CREATE INDEX "reviews_rels_path_idx" ON "reviews_rels" USING btree ("path");
  CREATE INDEX "reviews_rels_patients_id_idx" ON "reviews_rels" USING btree ("patients_id");
  CREATE INDEX "reviews_rels_platform_staff_id_idx" ON "reviews_rels" USING btree ("platform_staff_id");
  CREATE INDEX "_reviews_v_parent_idx" ON "_reviews_v" USING btree ("parent_id");
  CREATE INDEX "_reviews_v_version_version_stable_id_idx" ON "_reviews_v" USING btree ("version_stable_id");
  CREATE INDEX "_reviews_v_version_version_patient_idx" ON "_reviews_v" USING btree ("version_patient_id");
  CREATE INDEX "_reviews_v_version_version_clinic_idx" ON "_reviews_v" USING btree ("version_clinic_id");
  CREATE INDEX "_reviews_v_version_version_doctor_idx" ON "_reviews_v" USING btree ("version_doctor_id");
  CREATE INDEX "_reviews_v_version_version_treatment_idx" ON "_reviews_v" USING btree ("version_treatment_id");
  CREATE INDEX "_reviews_v_version_version_edited_by_idx" ON "_reviews_v" USING btree ("version_edited_by_id");
  CREATE INDEX "_reviews_v_version_version_public_measure_idx" ON "_reviews_v" USING btree ("version_public_measure");
  CREATE INDEX "_reviews_v_version_version_moderated_by_idx" ON "_reviews_v" USING btree ("version_moderated_by_id");
  CREATE INDEX "_reviews_v_version_version_withdrawal_state_idx" ON "_reviews_v" USING btree ("version_withdrawal_state");
  CREATE INDEX "_reviews_v_version_version_updated_at_idx" ON "_reviews_v" USING btree ("version_updated_at");
  CREATE INDEX "_reviews_v_version_version_created_at_idx" ON "_reviews_v" USING btree ("version_created_at");
  CREATE INDEX "_reviews_v_version_version_deleted_at_idx" ON "_reviews_v" USING btree ("version_deleted_at");
  CREATE INDEX "_reviews_v_created_at_idx" ON "_reviews_v" USING btree ("created_at");
  CREATE INDEX "_reviews_v_updated_at_idx" ON "_reviews_v" USING btree ("updated_at");
  CREATE INDEX "version_patient_version_clinic_version_doctor_version_tr_idx" ON "_reviews_v" USING btree ("version_patient_id","version_clinic_id","version_doctor_id","version_treatment_id");
  CREATE INDEX "_reviews_v_rels_order_idx" ON "_reviews_v_rels" USING btree ("order");
  CREATE INDEX "_reviews_v_rels_parent_idx" ON "_reviews_v_rels" USING btree ("parent_id");
  CREATE INDEX "_reviews_v_rels_path_idx" ON "_reviews_v_rels" USING btree ("path");
  CREATE INDEX "_reviews_v_rels_patients_id_idx" ON "_reviews_v_rels" USING btree ("patients_id");
  CREATE INDEX "_reviews_v_rels_platform_staff_id_idx" ON "_reviews_v_rels" USING btree ("platform_staff_id");
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderated_by_id_platform_staff_id_fk" FOREIGN KEY ("moderated_by_id") REFERENCES "public"."platform_staff"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "reviews_public_measure_idx" ON "reviews" USING btree ("public_measure");
  CREATE INDEX "reviews_moderated_by_idx" ON "reviews" USING btree ("moderated_by_id");
  CREATE INDEX "reviews_withdrawal_state_idx" ON "reviews" USING btree ("withdrawal_state");

  INSERT INTO "_reviews_v" (
    "parent_id",
    "version_stable_id",
    "version_review_date",
    "version_patient_id",
    "version_status",
    "version_author_visibility",
    "version_public_author_name",
    "version_star_rating",
    "version_comment",
    "version_clinic_id",
    "version_doctor_id",
    "version_treatment_id",
    "version_last_edited_at",
    "version_edited_by_name",
    "version_edited_by_id",
    "version_public_measure",
    "version_moderated_at",
    "version_public_comment",
    "version_public_notice",
    "version_moderation_reason",
    "version_moderated_by_id",
    "version_withdrawal_state",
    "version_withdrawal_source",
    "version_withdrawal_reason",
    "version_withdrawn_at",
    "version_updated_at",
    "version_created_at",
    "version_deleted_at",
    "created_at",
    "updated_at"
  )
  SELECT
    "reviews"."id",
    "reviews"."stable_id",
    "reviews"."review_date",
    "reviews"."patient_id",
    "reviews"."status"::text::"enum__reviews_v_version_status",
    "reviews"."author_visibility"::text::"enum__reviews_v_version_author_visibility",
    "reviews"."public_author_name",
    "reviews"."star_rating",
    "reviews"."comment",
    "reviews"."clinic_id",
    "reviews"."doctor_id",
    "reviews"."treatment_id",
    "reviews"."last_edited_at",
    "reviews"."edited_by_name",
    "reviews"."edited_by_id",
    'none'::"enum__reviews_v_version_public_measure",
    "reviews"."moderated_at",
    "reviews"."public_comment",
    "reviews"."public_notice",
    "reviews"."moderation_reason",
    "reviews"."moderated_by_id",
    'active'::"enum__reviews_v_version_withdrawal_state",
    "reviews"."withdrawal_source"::text::"enum__reviews_v_version_withdrawal_source",
    "reviews"."withdrawal_reason",
    "reviews"."withdrawn_at",
    "reviews"."updated_at",
    "reviews"."created_at",
    "reviews"."deleted_at",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM "reviews"
  WHERE NOT EXISTS (
    SELECT 1
    FROM "_reviews_v" AS "existing_version"
    WHERE "existing_version"."parent_id" = "reviews"."id"
  );`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reviews_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_reviews_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_reviews_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "reviews_rels" CASCADE;
  DROP TABLE "_reviews_v" CASCADE;
  DROP TABLE "_reviews_v_rels" CASCADE;
  ALTER TABLE "reviews" DROP CONSTRAINT "reviews_moderated_by_id_platform_staff_id_fk";
  
  DROP INDEX "reviews_public_measure_idx";
  DROP INDEX "reviews_moderated_by_idx";
  DROP INDEX "reviews_withdrawal_state_idx";
  ALTER TABLE "reviews" DROP COLUMN "public_measure";
  ALTER TABLE "reviews" DROP COLUMN "moderated_at";
  ALTER TABLE "reviews" DROP COLUMN "public_comment";
  ALTER TABLE "reviews" DROP COLUMN "public_notice";
  ALTER TABLE "reviews" DROP COLUMN "moderation_reason";
  ALTER TABLE "reviews" DROP COLUMN "moderated_by_id";
  ALTER TABLE "reviews" DROP COLUMN "withdrawal_state";
  ALTER TABLE "reviews" DROP COLUMN "withdrawal_source";
  ALTER TABLE "reviews" DROP COLUMN "withdrawal_reason";
  ALTER TABLE "reviews" DROP COLUMN "withdrawn_at";
  DROP TYPE "public"."enum_reviews_public_measure";
  DROP TYPE "public"."enum_reviews_withdrawal_state";
  DROP TYPE "public"."enum_reviews_withdrawal_source";
  DROP TYPE "public"."enum__reviews_v_version_status";
  DROP TYPE "public"."enum__reviews_v_version_author_visibility";
  DROP TYPE "public"."enum__reviews_v_version_public_measure";
  DROP TYPE "public"."enum__reviews_v_version_withdrawal_state";
  DROP TYPE "public"."enum__reviews_v_version_withdrawal_source";`)
}
