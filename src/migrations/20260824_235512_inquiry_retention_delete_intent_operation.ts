import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_inquiry_deletion_proofs_operation" ADD VALUE 'hard-delete-pending' BEFORE 'hard-deleted';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM "inquiry_deletion_proofs" WHERE "operation" = 'hard-delete-pending'
    ) THEN
      RAISE EXCEPTION 'Cannot roll back inquiry delete intents while pending operations still exist.';
    END IF;
  END $$;
  ALTER TABLE "inquiry_deletion_proofs" ALTER COLUMN "operation" SET DATA TYPE text;
  DROP TYPE "public"."enum_inquiry_deletion_proofs_operation";
  CREATE TYPE "public"."enum_inquiry_deletion_proofs_operation" AS ENUM('anonymized', 'hard-deleted');
  ALTER TABLE "inquiry_deletion_proofs" ALTER COLUMN "operation" SET DATA TYPE "public"."enum_inquiry_deletion_proofs_operation" USING "operation"::"public"."enum_inquiry_deletion_proofs_operation";`)
}
