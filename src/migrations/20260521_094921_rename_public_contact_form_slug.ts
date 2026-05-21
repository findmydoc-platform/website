import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM "forms" WHERE "slug" = 'holding-contact')
        AND EXISTS (SELECT 1 FROM "forms" WHERE "slug" = 'public-contact') THEN
        RAISE EXCEPTION 'Cannot rename form slug holding-contact to public-contact because public-contact already exists';
      END IF;

      UPDATE "forms"
      SET
        "slug" = 'public-contact',
        "generate_slug" = false,
        "updated_at" = now()
      WHERE "slug" = 'holding-contact';
    END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM "forms" WHERE "slug" = 'public-contact')
        AND EXISTS (SELECT 1 FROM "forms" WHERE "slug" = 'holding-contact') THEN
        RAISE EXCEPTION 'Cannot rename form slug public-contact to holding-contact because holding-contact already exists';
      END IF;

      UPDATE "forms"
      SET
        "slug" = 'holding-contact',
        "generate_slug" = false,
        "updated_at" = now()
      WHERE "slug" = 'public-contact';
    END $$;
  `)
}
