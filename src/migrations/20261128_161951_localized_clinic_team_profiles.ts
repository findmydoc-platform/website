import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "doctor_media_locales" (
    "localized_alt" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" integer NOT NULL
  );

  CREATE TABLE "doctors_locales" (
    "localized_biography" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" integer NOT NULL
  );

  ALTER TABLE "doctor_media_locales" ADD CONSTRAINT "doctor_media_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."doctor_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "doctors_locales" ADD CONSTRAINT "doctors_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "doctor_media_locales_locale_parent_id_unique" ON "doctor_media_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "doctor_media_locales_parent_id_idx" ON "doctor_media_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "doctors_locales_locale_parent_id_unique" ON "doctors_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "doctors_locales_parent_id_idx" ON "doctors_locales" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "doctor_media_locales" CASCADE;
  DROP TABLE "doctors_locales" CASCADE;`)
}
