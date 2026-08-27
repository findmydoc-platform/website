import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "inquiry_command_locks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "inquiry_command_locks_id" integer;
  CREATE UNIQUE INDEX "inquiry_command_locks_key_idx" ON "inquiry_command_locks" USING btree ("key");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inquiry_command_locks_fk" FOREIGN KEY ("inquiry_command_locks_id") REFERENCES "public"."inquiry_command_locks"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_inquiry_command_locks_id_idx" ON "payload_locked_documents_rels" USING btree ("inquiry_command_locks_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_inquiry_command_locks_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_inquiry_command_locks_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "inquiry_command_locks_id";
  DROP TABLE IF EXISTS "inquiry_command_locks" CASCADE;`)
}
