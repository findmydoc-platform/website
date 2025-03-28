import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_languages_name" AS ENUM('English', 'German', 'French', 'Spanish', 'Italian', 'Dutch', 'Portuguese', 'Russian', 'Chinese', 'Japanese', 'Arabic', 'Turkish');
  CREATE TYPE "public"."enum_languages_code" AS ENUM('en', 'de', 'fr', 'es', 'it', 'nl', 'pt', 'ru', 'zh', 'ja', 'ar', 'tr');
  CREATE TABLE IF NOT EXISTS "doctors_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"languages_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "languages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" "enum_languages_name" NOT NULL,
  	"code" "enum_languages_code" NOT NULL,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "accreditation" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"abbreviation" varchar NOT NULL,
  	"country" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "treatments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "treatments_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "procedures" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"short" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "procedures_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"treatments_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "review" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"user_id" integer NOT NULL,
  	"clinic_id" integer NOT NULL,
  	"doctor_id" integer,
  	"rating" numeric NOT NULL,
  	"comment" varchar NOT NULL,
  	"verified" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "users" ADD COLUMN "lastname" varchar NOT NULL;
  ALTER TABLE "users" ADD COLUMN "username" varchar NOT NULL;
  ALTER TABLE "users" ADD COLUMN "phone" varchar;
  ALTER TABLE "users" ADD COLUMN "street" varchar;
  ALTER TABLE "users" ADD COLUMN "city" varchar;
  ALTER TABLE "users" ADD COLUMN "country" varchar;
  ALTER TABLE "clinics_rels" ADD COLUMN "languages_id" integer;
  ALTER TABLE "clinics_rels" ADD COLUMN "accreditation_id" integer;
  ALTER TABLE "clinics_rels" ADD COLUMN "treatments_id" integer;
  ALTER TABLE "clinics_rels" ADD COLUMN "users_id" integer;
  ALTER TABLE "forms_blocks_select" ADD COLUMN "placeholder" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "languages_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "accreditation_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "treatments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "procedures_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "review_id" integer;
  DO $$ BEGIN
   ALTER TABLE "doctors_rels" ADD CONSTRAINT "doctors_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "doctors_rels" ADD CONSTRAINT "doctors_rels_languages_fk" FOREIGN KEY ("languages_id") REFERENCES "public"."languages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "treatments_rels" ADD CONSTRAINT "treatments_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."treatments"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "treatments_rels" ADD CONSTRAINT "treatments_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "procedures_rels" ADD CONSTRAINT "procedures_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."procedures"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "procedures_rels" ADD CONSTRAINT "procedures_rels_treatments_fk" FOREIGN KEY ("treatments_id") REFERENCES "public"."treatments"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "review" ADD CONSTRAINT "review_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "review" ADD CONSTRAINT "review_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "review" ADD CONSTRAINT "review_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "doctors_rels_order_idx" ON "doctors_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "doctors_rels_parent_idx" ON "doctors_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "doctors_rels_path_idx" ON "doctors_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "doctors_rels_languages_id_idx" ON "doctors_rels" USING btree ("languages_id");
  CREATE INDEX IF NOT EXISTS "languages_updated_at_idx" ON "languages" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "languages_created_at_idx" ON "languages" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "accreditation_updated_at_idx" ON "accreditation" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "accreditation_created_at_idx" ON "accreditation" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "treatments_updated_at_idx" ON "treatments" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "treatments_created_at_idx" ON "treatments" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "treatments_rels_order_idx" ON "treatments_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "treatments_rels_parent_idx" ON "treatments_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "treatments_rels_path_idx" ON "treatments_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "treatments_rels_categories_id_idx" ON "treatments_rels" USING btree ("categories_id");
  CREATE INDEX IF NOT EXISTS "procedures_updated_at_idx" ON "procedures" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "procedures_created_at_idx" ON "procedures" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "procedures_rels_order_idx" ON "procedures_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "procedures_rels_parent_idx" ON "procedures_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "procedures_rels_path_idx" ON "procedures_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "procedures_rels_treatments_id_idx" ON "procedures_rels" USING btree ("treatments_id");
  CREATE INDEX IF NOT EXISTS "review_user_idx" ON "review" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "review_clinic_idx" ON "review" USING btree ("clinic_id");
  CREATE INDEX IF NOT EXISTS "review_doctor_idx" ON "review" USING btree ("doctor_id");
  CREATE INDEX IF NOT EXISTS "review_updated_at_idx" ON "review" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "review_created_at_idx" ON "review" USING btree ("created_at");
  DO $$ BEGIN
   ALTER TABLE "clinics_rels" ADD CONSTRAINT "clinics_rels_languages_fk" FOREIGN KEY ("languages_id") REFERENCES "public"."languages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "clinics_rels" ADD CONSTRAINT "clinics_rels_accreditation_fk" FOREIGN KEY ("accreditation_id") REFERENCES "public"."accreditation"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "clinics_rels" ADD CONSTRAINT "clinics_rels_treatments_fk" FOREIGN KEY ("treatments_id") REFERENCES "public"."treatments"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "clinics_rels" ADD CONSTRAINT "clinics_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_languages_fk" FOREIGN KEY ("languages_id") REFERENCES "public"."languages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_accreditation_fk" FOREIGN KEY ("accreditation_id") REFERENCES "public"."accreditation"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_treatments_fk" FOREIGN KEY ("treatments_id") REFERENCES "public"."treatments"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_procedures_fk" FOREIGN KEY ("procedures_id") REFERENCES "public"."procedures"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_review_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE UNIQUE INDEX IF NOT EXISTS "users_username_idx" ON "users" USING btree ("username");
  CREATE INDEX IF NOT EXISTS "clinics_rels_languages_id_idx" ON "clinics_rels" USING btree ("languages_id");
  CREATE INDEX IF NOT EXISTS "clinics_rels_accreditation_id_idx" ON "clinics_rels" USING btree ("accreditation_id");
  CREATE INDEX IF NOT EXISTS "clinics_rels_treatments_id_idx" ON "clinics_rels" USING btree ("treatments_id");
  CREATE INDEX IF NOT EXISTS "clinics_rels_users_id_idx" ON "clinics_rels" USING btree ("users_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_languages_id_idx" ON "payload_locked_documents_rels" USING btree ("languages_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_accreditation_id_idx" ON "payload_locked_documents_rels" USING btree ("accreditation_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_treatments_id_idx" ON "payload_locked_documents_rels" USING btree ("treatments_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_procedures_id_idx" ON "payload_locked_documents_rels" USING btree ("procedures_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_review_id_idx" ON "payload_locked_documents_rels" USING btree ("review_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "doctors_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "languages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "accreditation" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "treatments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "treatments_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "procedures" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "procedures_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "review" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "doctors_rels" CASCADE;
  DROP TABLE "languages" CASCADE;
  DROP TABLE "accreditation" CASCADE;
  DROP TABLE "treatments" CASCADE;
  DROP TABLE "treatments_rels" CASCADE;
  DROP TABLE "procedures" CASCADE;
  DROP TABLE "procedures_rels" CASCADE;
  DROP TABLE "review" CASCADE;
  ALTER TABLE "clinics_rels" DROP CONSTRAINT "clinics_rels_languages_fk";
  
  ALTER TABLE "clinics_rels" DROP CONSTRAINT "clinics_rels_accreditation_fk";
  
  ALTER TABLE "clinics_rels" DROP CONSTRAINT "clinics_rels_treatments_fk";
  
  ALTER TABLE "clinics_rels" DROP CONSTRAINT "clinics_rels_users_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_languages_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_accreditation_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_treatments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_procedures_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_review_fk";
  
  DROP INDEX IF EXISTS "users_username_idx";
  DROP INDEX IF EXISTS "clinics_rels_languages_id_idx";
  DROP INDEX IF EXISTS "clinics_rels_accreditation_id_idx";
  DROP INDEX IF EXISTS "clinics_rels_treatments_id_idx";
  DROP INDEX IF EXISTS "clinics_rels_users_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_languages_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_accreditation_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_treatments_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_procedures_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_review_id_idx";
  ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;
  ALTER TABLE "users" DROP COLUMN IF EXISTS "lastname";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "username";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "phone";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "street";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "city";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "country";
  ALTER TABLE "clinics_rels" DROP COLUMN IF EXISTS "languages_id";
  ALTER TABLE "clinics_rels" DROP COLUMN IF EXISTS "accreditation_id";
  ALTER TABLE "clinics_rels" DROP COLUMN IF EXISTS "treatments_id";
  ALTER TABLE "clinics_rels" DROP COLUMN IF EXISTS "users_id";
  ALTER TABLE "forms_blocks_select" DROP COLUMN IF EXISTS "placeholder";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "languages_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "accreditation_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "treatments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "procedures_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "review_id";
  DROP TYPE "public"."enum_languages_name";
  DROP TYPE "public"."enum_languages_code";`)
}
