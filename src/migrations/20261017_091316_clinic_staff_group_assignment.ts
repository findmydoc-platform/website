import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_staff" ADD COLUMN "group_id" integer;
  ALTER TABLE "clinic_staff" ADD CONSTRAINT "clinic_staff_group_id_clinic_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."clinic_groups"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "clinic_staff_group_idx" ON "clinic_staff" USING btree ("group_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinic_staff" DROP CONSTRAINT "clinic_staff_group_id_clinic_groups_id_fk";

  DROP INDEX "clinic_staff_group_idx";
  ALTER TABLE "clinic_staff" DROP COLUMN "group_id";`)
}
