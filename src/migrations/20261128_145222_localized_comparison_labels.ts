import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "medical_specialties_locales" (
    "display_name" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" integer NOT NULL
  );

  CREATE TABLE "treatments_locales" (
    "display_name" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" integer NOT NULL
  );

  CREATE TABLE "cities_locales" (
    "display_name" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" integer NOT NULL
  );

  ALTER TABLE "medical_specialties_locales" ADD CONSTRAINT "medical_specialties_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."medical_specialties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "treatments_locales" ADD CONSTRAINT "treatments_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."treatments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cities_locales" ADD CONSTRAINT "cities_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "medical_specialties_locales_locale_parent_id_unique" ON "medical_specialties_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "medical_specialties_locales_parent_id_idx" ON "medical_specialties_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "treatments_locales_locale_parent_id_unique" ON "treatments_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "treatments_locales_parent_id_idx" ON "treatments_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cities_locales_locale_parent_id_unique" ON "cities_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "cities_locales_parent_id_idx" ON "cities_locales" USING btree ("_parent_id");`)

  // Only seed known records that retain the original catalog name.
  await db.execute(sql`
    INSERT INTO "treatments_locales" ("display_name", "_locale", "_parent_id")
    SELECT label.name, label.locale::"_locales", record.id
    FROM "treatments" AS record
    JOIN (VALUES
      ('77777777-7777-7777-7777-777777777777', 'Single Dental Implant', 'Einzelzahnimplantat'),
      ('88888888-8888-8888-8888-888888888888', 'Full Mouth Implants', 'Implantatversorgung für den gesamten Kiefer'),
      ('10000000-0000-0000-0000-000000000001', 'All-on-4', 'All-on-4'),
      ('10000000-0000-0000-0000-000000000002', 'All-on-6', 'All-on-6'),
      ('10000000-0000-0000-0000-000000000003', 'Clear Aligners', 'Transparente Zahnschienen'),
      ('301283c7-3e61-8060-a372-e06b61752ab3', 'Veneers', 'Veneers'),
      ('307283c7-3e61-805c-b91d-da48fbcdc795', 'Teeth Whitening', 'Zahnaufhellung'),
      ('301283c7-3e61-80fa-8109-d28bd6536f9c', 'Dental Crown', 'Zahnkrone'),
      ('307283c7-3e61-80d6-94c0-fa02da33e793', 'Dental Bridges', 'Zahnbrücken'),
      ('309283c7-3e61-80bd-9503-fab333638cd2', 'Root Canal Treatment', 'Wurzelkanalbehandlung'),
      ('10000000-0000-0000-0000-000000000004', 'Refractive Lens Exchange (RLE)', 'Refraktiver Linsenaustausch (RLE)'),
      ('10000000-0000-0000-0000-000000000005', 'ICL ( Implantable Collamer Lens)', 'Implantierbare Kontaktlinse (ICL)'),
      ('301283c7-3e61-80b3-b945-ec6f85954503', 'LASIK', 'LASIK'),
      ('301283c7-3e61-8001-94b9-cf3c9337774c', 'SMILE', 'SMILE'),
      ('10000000-0000-0000-0000-000000000006', 'Standard Cataract Surgery', 'Standardoperation bei Grauem Star'),
      ('10000000-0000-0000-0000-000000000007', 'Premium Cataract Surgery', 'Premiumoperation bei Grauem Star'),
      ('309283c7-3e61-8023-9e6c-d03d2ce22713', 'Corneal Cross - Linking', 'Hornhaut-Crosslinking'),
      ('31a283c7-3e61-80bd-a172-e786241d7c47', 'Keratoconus Treatment', 'Keratokonusbehandlung'),
      ('10000000-0000-0000-0000-000000000008', 'Rhinoplasty', 'Nasenkorrektur'),
      ('309283c7-3e61-80eb-acf6-f549c71f8752', 'Eyelid Surgery', 'Lidkorrektur'),
      ('301283c7-3e61-80fc-80c8-f1788dd7298f', 'Facelift', 'Gesichtsstraffung'),
      ('301283c7-3e61-8072-becd-fd7104f2d0c2', 'Breast Augmentation', 'Brustvergrößerung'),
      ('309283c7-3e61-8086-a2f0-ef899dcfc7ca', 'Breast Lift', 'Bruststraffung'),
      ('31a283c7-3e61-8023-9e95-c5a90bfa98ab', 'Breast Reduction', 'Brustverkleinerung'),
      ('10000000-0000-0000-0000-000000000009', 'Liposuction', 'Fettabsaugung'),
      ('10000000-0000-0000-0000-000000000010', 'Tummy Tuck', 'Bauchdeckenstraffung'),
      ('309283c7-3e61-80f7-9d57-e6f51ccba362', 'Mommy Makeover', 'Mommy Makeover'),
      ('309283c7-3e61-807e-8f86-e0b029aeeedd', 'Brazilian Butt Lift (BBL)', 'Brazilian Butt Lift (BBL)'),
      ('301283c7-3e61-8029-8295-db1f8fc26220', 'FUE Hair Transplant', 'FUE-Haartransplantation'),
      ('301283c7-3e61-80a6-9576-f11932316ca2', 'DHI Hair Transplant', 'DHI-Haartransplantation'),
      ('309283c7-3e61-80fa-bde3-f7f9002319dc', 'Sapphire FUE Hair Transplant', 'Saphir-FUE-Haartransplantation'),
      ('306283c7-3e61-8060-97a3-d879acffa9eb', 'Eyebrow Transplant', 'Augenbrauentransplantation'),
      ('306283c7-3e61-801b-a1ce-ffe4ad89e0a5', 'Beard Transplant', 'Barttransplantation'),
      ('301283c7-3e61-80c5-ba11-d6db1d765af5', 'PRP Hair Therapy', 'PRP-Haartherapie'),
      ('301283c7-3e61-809c-802a-ff12095b5a96', 'Botox', 'Botox'),
      ('309283c7-3e61-8030-b752-f73224bd6e0f', 'Dermal Fillers', 'Dermale Filler'),
      ('31a283c7-3e61-8002-9ff7-e116b7c2ef51', 'Acne treatment', 'Aknebehandlung'),
      ('301283c7-3e61-80f3-aaf3-f8bcf3441165', 'Skin Laser', 'Laserbehandlung der Haut'),
      ('31a283c7-3e61-80b7-9b36-c09e0039aa48', 'Laser Hair Removal', 'Laser-Haarentfernung')
    ) AS baseline(stable_id, shared_name, german_name)
      ON baseline.stable_id = record.stable_id::text AND baseline.shared_name = record.name
    CROSS JOIN LATERAL (VALUES
      (baseline.german_name, 'de'),
      (baseline.shared_name, 'en')
    ) AS label(name, locale)
    ON CONFLICT ("_locale", "_parent_id") DO NOTHING;

    INSERT INTO "medical_specialties_locales" ("display_name", "_locale", "_parent_id")
    SELECT label.name, label.locale::"_locales", record.id
    FROM "medical_specialties" AS record
    JOIN (VALUES
      ('10000000-0000-0000-0000-000000000001', 'Dental', 'Zahnmedizin'),
      ('10000000-0000-0000-0000-000000000002', 'Eye Care', 'Augenheilkunde'),
      ('10000000-0000-0000-0000-000000000003', 'Hair Restoration', 'Haarwiederherstellung'),
      ('10000000-0000-0000-0000-000000000004', 'Dermatology', 'Dermatologie'),
      ('10000000-0000-0000-0000-000000000005', 'Plastic Surgery', 'Plastische Chirurgie'),
      ('10000000-0000-0000-0000-000000000101', 'Dental Implants', 'Zahnimplantate'),
      ('10000000-0000-0000-0000-000000000102', 'Orthodontics', 'Kieferorthopädie'),
      ('309283c7-3e61-8030-8e91-e12d83af4107', 'Cosmetic Dentistry', 'Ästhetische Zahnmedizin'),
      ('309283c7-3e61-80ef-b24f-d385180dda3f', 'Restorative Dentistry', 'Restaurative Zahnmedizin'),
      ('10000000-0000-0000-0000-000000000201', 'Lens Surgery', 'Linsenchirurgie'),
      ('309283c7-3e61-805f-b8e1-e70cb9bd8bd3', 'Laser Vision Correction', 'Augenlaserkorrektur'),
      ('307283c7-3e61-8006-9975-e22160b5fff0', 'Cataract Surgery', 'Chirurgie des Grauen Stars'),
      ('309283c7-3e61-80e4-90f5-c10f8754bcae', 'Cornea', 'Hornhaut'),
      ('10000000-0000-0000-0000-000000000301', 'Scalp Hair Transplant', 'Kopfhaartransplantation'),
      ('309283c7-3e61-801b-9887-c3955ee2e458', 'Facial Hair Transplant', 'Gesichtshaartransplantation'),
      ('309283c7-3e61-804e-a67b-c8865d31267a', 'Hair Loss Therapy', 'Therapie bei Haarausfall'),
      ('31a283c7-3e61-80b0-af17-edcaa95d33b2', 'Skin Conditions', 'Hauterkrankungen'),
      ('301283c7-3e61-80f3-aaf3-f8bcf3441165', 'Laser Dermatology', 'Laserdermatologie'),
      ('10000000-0000-0000-0000-000000000103', 'Injectables', 'Injektionsbehandlungen'),
      ('10000000-0000-0000-0000-000000000501', 'Facial Surgery', 'Gesichtschirurgie'),
      ('309283c7-3e61-8056-8064-e85dffdd096e', 'Breast Surgery', 'Brustchirurgie'),
      ('10000000-0000-0000-0000-000000000502', 'Body Contouring', 'Körperformung')
    ) AS baseline(stable_id, shared_name, german_name)
      ON baseline.stable_id = record.stable_id::text AND baseline.shared_name = record.name
    CROSS JOIN LATERAL (VALUES
      (baseline.german_name, 'de'),
      (baseline.shared_name, 'en')
    ) AS label(name, locale)
    ON CONFLICT ("_locale", "_parent_id") DO NOTHING;

    INSERT INTO "cities_locales" ("display_name", "_locale", "_parent_id")
    SELECT label.name, label.locale::"_locales", record.id
    FROM "cities" AS record
    JOIN (VALUES
      ('22222222-2222-2222-2222-222222222222', 'Istanbul', 'Istanbul'),
      ('33333333-3333-3333-3333-333333333333', 'Ankara', 'Ankara'),
      ('44444444-4444-4444-4444-444444444444', 'Izmir', 'Izmir'),
      ('55555555-5555-5555-5555-555555555555', 'Antalya', 'Antalya'),
      ('66666666-6666-6666-6666-666666666666', 'Bursa', 'Bursa')
    ) AS baseline(stable_id, shared_name, german_name)
      ON baseline.stable_id = record.stable_id::text AND baseline.shared_name = record.name
    CROSS JOIN LATERAL (VALUES
      (baseline.german_name, 'de'),
      (baseline.shared_name, 'en')
    ) AS label(name, locale)
    ON CONFLICT ("_locale", "_parent_id") DO NOTHING;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "medical_specialties_locales" CASCADE;
  DROP TABLE "treatments_locales" CASCADE;
  DROP TABLE "cities_locales" CASCADE;`)
}
