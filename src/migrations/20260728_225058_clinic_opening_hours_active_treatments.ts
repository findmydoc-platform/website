import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinics" ADD COLUMN "opening_hours_monday_is_closed" boolean;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_monday_opens_at" varchar;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_monday_closes_at" varchar;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_tuesday_is_closed" boolean;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_tuesday_opens_at" varchar;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_tuesday_closes_at" varchar;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_wednesday_is_closed" boolean;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_wednesday_opens_at" varchar;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_wednesday_closes_at" varchar;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_thursday_is_closed" boolean;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_thursday_opens_at" varchar;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_thursday_closes_at" varchar;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_friday_is_closed" boolean;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_friday_opens_at" varchar;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_friday_closes_at" varchar;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_saturday_is_closed" boolean;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_saturday_opens_at" varchar;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_saturday_closes_at" varchar;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_sunday_is_closed" boolean;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_sunday_opens_at" varchar;
  ALTER TABLE "clinics" ADD COLUMN "opening_hours_sunday_closes_at" varchar;
  ALTER TABLE "clinictreatments" ADD COLUMN "active" boolean;

  UPDATE "clinictreatments"
  SET "active" = true
  WHERE "active" IS NULL;

  ALTER TABLE "clinictreatments"
    ALTER COLUMN "active" SET DEFAULT false,
    ALTER COLUMN "active" SET NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "clinics" DROP COLUMN "opening_hours_monday_is_closed";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_monday_opens_at";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_monday_closes_at";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_tuesday_is_closed";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_tuesday_opens_at";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_tuesday_closes_at";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_wednesday_is_closed";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_wednesday_opens_at";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_wednesday_closes_at";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_thursday_is_closed";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_thursday_opens_at";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_thursday_closes_at";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_friday_is_closed";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_friday_opens_at";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_friday_closes_at";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_saturday_is_closed";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_saturday_opens_at";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_saturday_closes_at";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_sunday_is_closed";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_sunday_opens_at";
  ALTER TABLE "clinics" DROP COLUMN "opening_hours_sunday_closes_at";
  ALTER TABLE "clinictreatments" DROP COLUMN "active";`)
}
