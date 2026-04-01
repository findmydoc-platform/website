import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cookie_consent" ADD COLUMN "privacy_policy_page_id" integer;
  ALTER TABLE "cookie_consent" ADD CONSTRAINT "cookie_consent_privacy_policy_page_id_pages_id_fk" FOREIGN KEY ("privacy_policy_page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cookie_consent_privacy_policy_page_idx" ON "cookie_consent" USING btree ("privacy_policy_page_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cookie_consent" DROP CONSTRAINT "cookie_consent_privacy_policy_page_id_pages_id_fk";
  
  DROP INDEX "cookie_consent_privacy_policy_page_idx";
  ALTER TABLE "cookie_consent" DROP COLUMN "privacy_policy_page_id";`)
}
