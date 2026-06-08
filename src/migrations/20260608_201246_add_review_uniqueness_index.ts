import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE UNIQUE INDEX "patient_clinic_doctor_treatment_idx" ON "reviews" USING btree ("patient_id","clinic_id","doctor_id","treatment_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "patient_clinic_doctor_treatment_idx";`)
}
