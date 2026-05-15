import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinics" ALTER COLUMN "contact_phone_number" DROP NOT NULL;
  ALTER TABLE "clinics" ALTER COLUMN "contact_email" DROP NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinics" ALTER COLUMN "contact_phone_number" SET NOT NULL;
  ALTER TABLE "clinics" ALTER COLUMN "contact_email" SET NOT NULL;`)
}
