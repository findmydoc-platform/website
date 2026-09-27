import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_transactional_email_suppressions_runtime_environment" AS ENUM('preview', 'production');
  CREATE TYPE "public"."enum_transactional_email_suppressions_reason" AS ENUM('hard-bounce', 'spam-complaint');
  CREATE TYPE "public"."enum_transactional_email_suppressions_source" AS ENUM('lettermint');
  CREATE TABLE "transactional_email_suppressions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"runtime_environment" "enum_transactional_email_suppressions_runtime_environment" NOT NULL,
  	"recipient_digest" varchar NOT NULL,
  	"reason" "enum_transactional_email_suppressions_reason" NOT NULL,
  	"first_observed_at" timestamp(3) with time zone NOT NULL,
  	"last_observed_at" timestamp(3) with time zone NOT NULL,
  	"source" "enum_transactional_email_suppressions_source" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "provider_recipient_digest" varchar;
  CREATE INDEX "transactional_email_suppressions_updated_at_idx" ON "transactional_email_suppressions" USING btree ("updated_at");
  CREATE INDEX "transactional_email_suppressions_created_at_idx" ON "transactional_email_suppressions" USING btree ("created_at");
  CREATE UNIQUE INDEX "runtimeEnvironment_recipientDigest_idx" ON "transactional_email_suppressions" USING btree ("runtime_environment","recipient_digest");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "transactional_email_suppressions" CASCADE;
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "provider_recipient_digest";
  DROP TYPE "public"."enum_transactional_email_suppressions_runtime_environment";
  DROP TYPE "public"."enum_transactional_email_suppressions_reason";
  DROP TYPE "public"."enum_transactional_email_suppressions_source";`)
}
