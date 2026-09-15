import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_transactional_email_outbox_command_type" AS ENUM('auth.email-verification', 'auth.invitation', 'auth.password-recovery', 'conversation.external-message-received', 'moderation.report-received', 'moderation.report-decided', 'moderation.appeal-received', 'moderation.appeal-decided', 'clinic.registration-received');
  CREATE TYPE "public"."enum_transactional_email_outbox_runtime_environment" AS ENUM('local', 'test', 'ci', 'preview', 'production');
  CREATE TYPE "public"."enum_transactional_email_outbox_state" AS ENUM('queued', 'prepared', 'accepted', 'delivered', 'suppressed', 'bounced', 'complained', 'failed', 'expired');
  CREATE TYPE "public"."enum_transactional_email_events_type" AS ENUM('command.accepted');
  CREATE TYPE "public"."enum_transactional_email_events_source" AS ENUM('command', 'worker', 'provider');
  CREATE TABLE "transactional_email_outbox" (
    "id" serial PRIMARY KEY NOT NULL,
    "command_type" "enum_transactional_email_outbox_command_type" NOT NULL,
    "operation_reference" varchar NOT NULL,
    "command_payload" jsonb NOT NULL,
    "runtime_environment" "enum_transactional_email_outbox_runtime_environment" NOT NULL,
    "state" "enum_transactional_email_outbox_state" NOT NULL,
    "provider_idempotency_key" varchar NOT NULL,
    "recipient_address" varchar NOT NULL,
    "recipient_digest" varchar NOT NULL,
    "latest_event_sequence" numeric NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "transactional_email_events" (
    "id" serial PRIMARY KEY NOT NULL,
    "outbox_id" integer NOT NULL,
    "sequence" numeric NOT NULL,
    "type" "enum_transactional_email_events_type" NOT NULL,
    "source" "enum_transactional_email_events_source" NOT NULL,
    "provider_event_id" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "transactional_email_events" ADD CONSTRAINT "transactional_email_events_outbox_id_transactional_email_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."transactional_email_outbox"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "transactional_email_outbox_command_type_idx" ON "transactional_email_outbox" USING btree ("command_type");
  CREATE INDEX "transactional_email_outbox_state_idx" ON "transactional_email_outbox" USING btree ("state");
  CREATE UNIQUE INDEX "transactional_email_outbox_provider_idempotency_key_idx" ON "transactional_email_outbox" USING btree ("provider_idempotency_key");
  CREATE INDEX "transactional_email_outbox_updated_at_idx" ON "transactional_email_outbox" USING btree ("updated_at");
  CREATE INDEX "transactional_email_outbox_created_at_idx" ON "transactional_email_outbox" USING btree ("created_at");
  CREATE UNIQUE INDEX "commandType_operationReference_idx" ON "transactional_email_outbox" USING btree ("command_type","operation_reference");
  CREATE INDEX "transactional_email_events_outbox_idx" ON "transactional_email_events" USING btree ("outbox_id");
  CREATE UNIQUE INDEX "transactional_email_events_provider_event_id_idx" ON "transactional_email_events" USING btree ("provider_event_id");
  CREATE INDEX "transactional_email_events_updated_at_idx" ON "transactional_email_events" USING btree ("updated_at");
  CREATE INDEX "transactional_email_events_created_at_idx" ON "transactional_email_events" USING btree ("created_at");
  CREATE UNIQUE INDEX "outbox_sequence_idx" ON "transactional_email_events" USING btree ("outbox_id","sequence");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "transactional_email_outbox" CASCADE;
  DROP TABLE "transactional_email_events" CASCADE;
  DROP TYPE "public"."enum_transactional_email_outbox_command_type";
  DROP TYPE "public"."enum_transactional_email_outbox_runtime_environment";
  DROP TYPE "public"."enum_transactional_email_outbox_state";
  DROP TYPE "public"."enum_transactional_email_events_type";
  DROP TYPE "public"."enum_transactional_email_events_source";`)
}
