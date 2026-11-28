import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "clinic_media_locales" (
  	"localized_alt" varchar,
  	"localized_caption" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "clinics_locales" (
  	"localized_description" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "clinic_media_locales" ADD CONSTRAINT "clinic_media_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."clinic_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clinics_locales" ADD CONSTRAINT "clinics_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "clinic_media_locales_locale_parent_id_unique" ON "clinic_media_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "clinic_media_locales_parent_id_idx" ON "clinic_media_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "clinics_locales_locale_parent_id_unique" ON "clinics_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "clinics_locales_parent_id_idx" ON "clinics_locales" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "clinic_media_locales" CASCADE;
  DROP TABLE "clinics_locales" CASCADE;`)
}
