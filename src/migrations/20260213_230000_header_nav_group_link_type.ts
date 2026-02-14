import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum enum_values
        JOIN pg_type enum_type ON enum_type.oid = enum_values.enumtypid
        JOIN pg_namespace enum_namespace ON enum_namespace.oid = enum_type.typnamespace
        WHERE enum_namespace.nspname = 'public'
          AND enum_type.typname = 'enum_header_nav_items_link_type'
          AND enum_values.enumlabel = 'group'
      ) THEN
        ALTER TYPE "public"."enum_header_nav_items_link_type" ADD VALUE 'group';
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_enum enum_values
        JOIN pg_type enum_type ON enum_type.oid = enum_values.enumtypid
        JOIN pg_namespace enum_namespace ON enum_namespace.oid = enum_type.typnamespace
        WHERE enum_namespace.nspname = 'public'
          AND enum_type.typname = 'enum_header_nav_items_link_type'
          AND enum_values.enumlabel = 'group'
      ) THEN
        UPDATE "header_nav_items"
        SET "link_type" = 'custom'
        WHERE "link_type"::text = 'group';

        ALTER TABLE "header_nav_items"
          ALTER COLUMN "link_type" DROP DEFAULT;

        CREATE TYPE "public"."enum_header_nav_items_link_type_new" AS ENUM('reference', 'custom');

        ALTER TABLE "header_nav_items"
          ALTER COLUMN "link_type" TYPE "public"."enum_header_nav_items_link_type_new"
          USING ("link_type"::text::"public"."enum_header_nav_items_link_type_new");

        DROP TYPE "public"."enum_header_nav_items_link_type";
        ALTER TYPE "public"."enum_header_nav_items_link_type_new" RENAME TO "enum_header_nav_items_link_type";

        ALTER TABLE "header_nav_items"
          ALTER COLUMN "link_type" SET DEFAULT 'reference';
      END IF;
    END $$;
  `)
}
