import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "doctors" ADD COLUMN "active" boolean DEFAULT true NOT NULL;

   UPDATE "cities" AS target
   SET "coordinates" = ST_MakePoint(source.longitude, source.latitude)
   FROM (
     VALUES
       ('22222222-2222-2222-2222-222222222222', 28.9784, 41.0082),
       ('33333333-3333-3333-3333-333333333333', 32.8597, 39.9334),
       ('44444444-4444-4444-4444-444444444444', 27.1428, 38.4237),
       ('55555555-5555-5555-5555-555555555555', 30.7133, 36.8969),
       ('66666666-6666-6666-6666-666666666666', 29.0665, 40.1828)
   ) AS source(stable_id, longitude, latitude)
   WHERE target."stable_id" = source.stable_id
     AND target."coordinates" IS DISTINCT FROM ST_MakePoint(source.longitude, source.latitude);

   UPDATE "clinics" AS target
   SET "coordinates" = ST_MakePoint(source.longitude, source.latitude)
   FROM (
     VALUES
       ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 28.987, 41.0212),
       ('seed-clinic-istanbul-bosphorus', 29.0152, 41.0547),
       ('seed-clinic-ankara-harmony', 32.8663, 39.9258),
       ('seed-clinic-ankara-capital', 32.8596, 39.9174),
       ('seed-clinic-izmir-coast', 27.1482, 38.4324),
       ('seed-clinic-izmir-ege', 27.1321, 38.4198),
       ('seed-clinic-antalya-medvista', 30.7052, 36.8841),
       ('seed-clinic-antalya-riviera', 30.6897, 36.9004),
       ('seed-clinic-bursa-nova', 29.0603, 40.195),
       ('seed-clinic-bursa-green', 29.0749, 40.1772)
   ) AS source(stable_id, longitude, latitude)
   WHERE target."stable_id" = source.stable_id
     AND target."coordinates" IS DISTINCT FROM ST_MakePoint(source.longitude, source.latitude);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "cities" AS target
   SET "coordinates" = ST_MakePoint(source.latitude, source.longitude)
   FROM (
     VALUES
       ('22222222-2222-2222-2222-222222222222', 28.9784, 41.0082),
       ('33333333-3333-3333-3333-333333333333', 32.8597, 39.9334),
       ('44444444-4444-4444-4444-444444444444', 27.1428, 38.4237),
       ('55555555-5555-5555-5555-555555555555', 30.7133, 36.8969),
       ('66666666-6666-6666-6666-666666666666', 29.0665, 40.1828)
   ) AS source(stable_id, longitude, latitude)
   WHERE target."stable_id" = source.stable_id
     AND target."coordinates" IS DISTINCT FROM ST_MakePoint(source.latitude, source.longitude);

   UPDATE "clinics" AS target
   SET "coordinates" = ST_MakePoint(source.latitude, source.longitude)
   FROM (
     VALUES
       ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 28.987, 41.0212),
       ('seed-clinic-istanbul-bosphorus', 29.0152, 41.0547),
       ('seed-clinic-ankara-harmony', 32.8663, 39.9258),
       ('seed-clinic-ankara-capital', 32.8596, 39.9174),
       ('seed-clinic-izmir-coast', 27.1482, 38.4324),
       ('seed-clinic-izmir-ege', 27.1321, 38.4198),
       ('seed-clinic-antalya-medvista', 30.7052, 36.8841),
       ('seed-clinic-antalya-riviera', 30.6897, 36.9004),
       ('seed-clinic-bursa-nova', 29.0603, 40.195),
       ('seed-clinic-bursa-green', 29.0749, 40.1772)
   ) AS source(stable_id, longitude, latitude)
   WHERE target."stable_id" = source.stable_id
     AND target."coordinates" IS DISTINCT FROM ST_MakePoint(source.latitude, source.longitude);

   ALTER TABLE "doctors" DROP COLUMN "active";`)
}
