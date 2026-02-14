import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_clinics_verification') THEN
        CREATE TYPE "public"."enum_clinics_verification" AS ENUM('unverified', 'bronze', 'silver', 'gold');
      END IF;
    END $$;

    ALTER TABLE "clinics"
      ADD COLUMN IF NOT EXISTS "verification" "enum_clinics_verification" DEFAULT 'unverified' NOT NULL;

    UPDATE "clinics"
      SET "verification" = 'unverified'
      WHERE "verification" IS NULL;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "clinics" DROP COLUMN IF EXISTS "verification";

    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_clinics_verification') THEN
        DROP TYPE "public"."enum_clinics_verification";
      END IF;
    END $$;
  `)
}
