import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_header_nav_items_sub_items_link_type" AS ENUM('reference', 'custom');

    CREATE TABLE IF NOT EXISTS "header_nav_items_sub_items" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "link_type" "enum_header_nav_items_sub_items_link_type" DEFAULT 'reference',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "header_nav_items_sub_items_order_idx" ON "header_nav_items_sub_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "header_nav_items_sub_items_parent_id_idx" ON "header_nav_items_sub_items" USING btree ("_parent_id");

    ALTER TABLE "header_nav_items_sub_items"
      ADD CONSTRAINT "header_nav_items_sub_items_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."header_nav_items"("id") ON DELETE cascade ON UPDATE no action;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "header_nav_items_sub_items" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_header_nav_items_sub_items_link_type";
  `)
}
