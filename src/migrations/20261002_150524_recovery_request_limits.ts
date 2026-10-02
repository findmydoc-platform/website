import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_recovery_request_events_environment" AS ENUM('local', 'test', 'ci', 'preview', 'production');
  CREATE TYPE "public"."enum_recovery_request_events_dimension" AS ENUM('target', 'ip');
  CREATE TABLE "recovery_request_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"environment" "enum_recovery_request_events_environment" NOT NULL,
  	"dimension" "enum_recovery_request_events_dimension" NOT NULL,
  	"key_version" varchar NOT NULL,
  	"digest" varchar NOT NULL,
  	"observed_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE INDEX "recovery_request_events_observed_at_idx" ON "recovery_request_events" USING btree ("observed_at");
  CREATE INDEX "environment_dimension_keyVersion_digest_observedAt_idx" ON "recovery_request_events" USING btree ("environment","dimension","key_version","digest","observed_at");
  ALTER TABLE "recovery_request_events" ENABLE ROW LEVEL SECURITY;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "recovery_request_events" CASCADE;
  DROP TYPE "public"."enum_recovery_request_events_environment";
  DROP TYPE "public"."enum_recovery_request_events_dimension";`)
}
