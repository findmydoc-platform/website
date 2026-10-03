import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_staff" ADD COLUMN "invitation_authorized_at" timestamp(3) with time zone;
  CREATE INDEX "clinic_staff_invitation_authorized_at_idx" ON "clinic_staff" USING btree ("invitation_authorized_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "clinic_staff_invitation_authorized_at_idx";
  ALTER TABLE "clinic_staff" DROP COLUMN "invitation_authorized_at";`)
}
