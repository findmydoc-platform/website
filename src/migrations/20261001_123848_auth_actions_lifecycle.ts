import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_auth_actions_action_type" AS ENUM('patient-verification', 'clinic-invitation', 'patient-recovery', 'clinic-recovery', 'platform-recovery');
  CREATE TYPE "public"."enum_auth_actions_environment" AS ENUM('local', 'test', 'ci', 'preview', 'production');
  CREATE TYPE "public"."enum_auth_actions_state" AS ENUM('pending', 'active', 'confirmed', 'completed', 'superseded', 'expired', 'revoked');
  CREATE TYPE "public"."enum_auth_actions_outcome_code" AS ENUM('ineligible', 'source-unavailable', 'recipient-changed', 'superseded');
  CREATE TYPE "public"."enum_auth_actions_supabase_token_type" AS ENUM('magiclink', 'invite', 'recovery');
  CREATE TYPE "public"."enum_auth_actions_callback_destination" AS ENUM('website-auth-callback');
  CREATE TYPE "public"."enum_auth_actions_completion_route" AS ENUM('/patient/inquiries', '/auth/invite/complete', '/auth/password/reset/complete');
  CREATE TYPE "public"."enum_auth_actions_final_destination" AS ENUM('patient-inquiries', 'clinic-dashboard', 'platform-administration');
  CREATE TABLE "auth_actions" (
    "id" serial PRIMARY KEY NOT NULL,
    "action_type" "enum_auth_actions_action_type" NOT NULL,
    "environment" "enum_auth_actions_environment" NOT NULL,
    "state" "enum_auth_actions_state" DEFAULT 'pending' NOT NULL,
    "expires_at" timestamp(3) with time zone NOT NULL,
    "terminal_at" timestamp(3) with time zone,
    "outcome_code" "enum_auth_actions_outcome_code",
    "supabase_token_type" "enum_auth_actions_supabase_token_type" NOT NULL,
    "callback_destination" "enum_auth_actions_callback_destination" NOT NULL,
    "completion_route" "enum_auth_actions_completion_route" NOT NULL,
    "final_destination" "enum_auth_actions_final_destination" NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "auth_actions_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "patients_id" integer,
    "clinic_staff_id" integer,
    "platform_staff_id" integer
  );

  ALTER TABLE "auth_actions_rels" ADD CONSTRAINT "auth_actions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."auth_actions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "auth_actions_rels" ADD CONSTRAINT "auth_actions_rels_patients_fk" FOREIGN KEY ("patients_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "auth_actions_rels" ADD CONSTRAINT "auth_actions_rels_clinic_staff_fk" FOREIGN KEY ("clinic_staff_id") REFERENCES "public"."clinic_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "auth_actions_rels" ADD CONSTRAINT "auth_actions_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "auth_actions_state_idx" ON "auth_actions" USING btree ("state");
  CREATE INDEX "auth_actions_expires_at_idx" ON "auth_actions" USING btree ("expires_at");
  CREATE INDEX "auth_actions_terminal_at_idx" ON "auth_actions" USING btree ("terminal_at");
  CREATE INDEX "auth_actions_updated_at_idx" ON "auth_actions" USING btree ("updated_at");
  CREATE INDEX "auth_actions_created_at_idx" ON "auth_actions" USING btree ("created_at");
  CREATE INDEX "auth_actions_rels_order_idx" ON "auth_actions_rels" USING btree ("order");
  CREATE INDEX "auth_actions_rels_parent_idx" ON "auth_actions_rels" USING btree ("parent_id");
  CREATE INDEX "auth_actions_rels_path_idx" ON "auth_actions_rels" USING btree ("path");
  CREATE INDEX "auth_actions_rels_patients_id_idx" ON "auth_actions_rels" USING btree ("patients_id");
  CREATE INDEX "auth_actions_rels_clinic_staff_id_idx" ON "auth_actions_rels" USING btree ("clinic_staff_id");
  CREATE INDEX "auth_actions_rels_platform_staff_id_idx" ON "auth_actions_rels" USING btree ("platform_staff_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "auth_actions" CASCADE;
  DROP TABLE "auth_actions_rels" CASCADE;
  DROP TYPE "public"."enum_auth_actions_action_type";
  DROP TYPE "public"."enum_auth_actions_environment";
  DROP TYPE "public"."enum_auth_actions_state";
  DROP TYPE "public"."enum_auth_actions_outcome_code";
  DROP TYPE "public"."enum_auth_actions_supabase_token_type";
  DROP TYPE "public"."enum_auth_actions_callback_destination";
  DROP TYPE "public"."enum_auth_actions_completion_route";
  DROP TYPE "public"."enum_auth_actions_final_destination";`)
}
