import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $migration$
    BEGIN
      IF to_regclass('public.review_responses') IS NULL
        OR to_regclass('public._review_responses_v') IS NULL
        OR to_regclass('public.review_appeals') IS NULL
        OR to_regclass('public._review_appeals_v') IS NULL
        OR to_regclass('public.clinic_profile_drafts') IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'clinics'
            AND column_name = 'profile_revision'
        )
        OR NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'clinics'
            AND column_name = 'address_country_id'
        )
        OR NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'search'
            AND column_name = 'country_id'
        )
      THEN
        RAISE EXCEPTION 'Review schema snapshot alignment failed: an earlier migration is missing';
      END IF;
    END
    $migration$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Snapshot-only alignment; preceding migrations own the asserted schema.
}
