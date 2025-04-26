import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "accreditation" ALTER COLUMN "description" SET DATA TYPE jsonb;
  ALTER TABLE "accreditation" ADD COLUMN "icon_id" integer;
  DO $$ BEGIN
   ALTER TABLE "accreditation" ADD CONSTRAINT "accreditation_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "accreditation_icon_idx" ON "accreditation" USING btree ("icon_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "accreditation" DROP CONSTRAINT "accreditation_icon_id_media_id_fk";
  
  DROP INDEX IF EXISTS "accreditation_icon_idx";
  ALTER TABLE "accreditation" ALTER COLUMN "description" SET DATA TYPE varchar;
  ALTER TABLE "accreditation" DROP COLUMN IF EXISTS "icon_id";`)
}
