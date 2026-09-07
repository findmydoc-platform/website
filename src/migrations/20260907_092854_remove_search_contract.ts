import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Destructive contract stage: deploy only after the plugin-free application is verified.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DELETE FROM "payload_preferences"
      WHERE "key" = 'collection-search' OR "key" ~ '^collection-search-[0-9]+$';

    DELETE FROM "payload_locked_documents" AS locks
      WHERE locks."global_slug" IS NULL
      AND EXISTS (
        SELECT 1 FROM "payload_locked_documents_rels" AS relation
        WHERE relation."parent_id" = locks."id" AND relation."path" = 'document'
          AND relation."search_id" IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM "payload_locked_documents_rels" AS relation
        WHERE relation."parent_id" = locks."id" AND relation."path" = 'document'
          AND (relation."search_id" IS NULL OR jsonb_strip_nulls(to_jsonb(relation)
            - ARRAY['id', 'order', 'parent_id', 'path', 'search_id']) <> '{}'::jsonb)
      );

    DELETE FROM "payload_locked_documents_rels" AS relation
      WHERE relation."path" = 'document' AND relation."search_id" IS NOT NULL
        AND jsonb_strip_nulls(to_jsonb(relation)
          - ARRAY['id', 'order', 'parent_id', 'path', 'search_id']) = '{}'::jsonb;

    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_search_fk";
    DROP INDEX "payload_locked_documents_rels_search_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "search_id";
    DROP TABLE "search_categories";
    DROP TABLE "search_rels";
    DROP TABLE "search";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $migration$
    BEGIN
      RAISE EXCEPTION 'Cannot roll back the search contract because its storage was permanently deleted. Restore a pre-contract backup or roll forward.';
    END
    $migration$;
  `)
}
