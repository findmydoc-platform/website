import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      CREATE TYPE "public"."enum_footer_about_links_link_type" AS ENUM('reference', 'custom');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$
    BEGIN
      CREATE TYPE "public"."enum_footer_service_links_link_type" AS ENUM('reference', 'custom');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$
    BEGIN
      CREATE TYPE "public"."enum_footer_information_links_link_type" AS ENUM('reference', 'custom');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "footer_about_links" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "link_type" "enum_footer_about_links_link_type" DEFAULT 'reference',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "footer_service_links" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "link_type" "enum_footer_service_links_link_type" DEFAULT 'reference',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "footer_information_links" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "link_type" "enum_footer_information_links_link_type" DEFAULT 'reference',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "footer_about_links_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "pages_id" integer,
      "posts_id" integer
    );

    CREATE TABLE IF NOT EXISTS "footer_service_links_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "pages_id" integer,
      "posts_id" integer
    );

    CREATE TABLE IF NOT EXISTS "footer_information_links_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "pages_id" integer,
      "posts_id" integer
    );

    CREATE INDEX IF NOT EXISTS "footer_about_links_order_idx" ON "footer_about_links" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "footer_about_links_parent_id_idx" ON "footer_about_links" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "footer_service_links_order_idx" ON "footer_service_links" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "footer_service_links_parent_id_idx" ON "footer_service_links" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "footer_information_links_order_idx" ON "footer_information_links" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "footer_information_links_parent_id_idx" ON "footer_information_links" USING btree ("_parent_id");

    CREATE INDEX IF NOT EXISTS "footer_about_links_rels_order_idx" ON "footer_about_links_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "footer_about_links_rels_parent_idx" ON "footer_about_links_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "footer_about_links_rels_path_idx" ON "footer_about_links_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "footer_about_links_rels_pages_id_idx" ON "footer_about_links_rels" USING btree ("pages_id");
    CREATE INDEX IF NOT EXISTS "footer_about_links_rels_posts_id_idx" ON "footer_about_links_rels" USING btree ("posts_id");

    CREATE INDEX IF NOT EXISTS "footer_service_links_rels_order_idx" ON "footer_service_links_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "footer_service_links_rels_parent_idx" ON "footer_service_links_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "footer_service_links_rels_path_idx" ON "footer_service_links_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "footer_service_links_rels_pages_id_idx" ON "footer_service_links_rels" USING btree ("pages_id");
    CREATE INDEX IF NOT EXISTS "footer_service_links_rels_posts_id_idx" ON "footer_service_links_rels" USING btree ("posts_id");

    CREATE INDEX IF NOT EXISTS "footer_information_links_rels_order_idx" ON "footer_information_links_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "footer_information_links_rels_parent_idx" ON "footer_information_links_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "footer_information_links_rels_path_idx" ON "footer_information_links_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "footer_information_links_rels_pages_id_idx" ON "footer_information_links_rels" USING btree ("pages_id");
    CREATE INDEX IF NOT EXISTS "footer_information_links_rels_posts_id_idx" ON "footer_information_links_rels" USING btree ("posts_id");

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'footer_about_links_parent_id_fk'
      ) THEN
        ALTER TABLE "footer_about_links"
          ADD CONSTRAINT "footer_about_links_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'footer_service_links_parent_id_fk'
      ) THEN
        ALTER TABLE "footer_service_links"
          ADD CONSTRAINT "footer_service_links_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'footer_information_links_parent_id_fk'
      ) THEN
        ALTER TABLE "footer_information_links"
          ADD CONSTRAINT "footer_information_links_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'footer_about_links_rels_parent_fk'
      ) THEN
        ALTER TABLE "footer_about_links_rels"
          ADD CONSTRAINT "footer_about_links_rels_parent_fk"
          FOREIGN KEY ("parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'footer_about_links_rels_pages_fk'
      ) THEN
        ALTER TABLE "footer_about_links_rels"
          ADD CONSTRAINT "footer_about_links_rels_pages_fk"
          FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'footer_about_links_rels_posts_fk'
      ) THEN
        ALTER TABLE "footer_about_links_rels"
          ADD CONSTRAINT "footer_about_links_rels_posts_fk"
          FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'footer_service_links_rels_parent_fk'
      ) THEN
        ALTER TABLE "footer_service_links_rels"
          ADD CONSTRAINT "footer_service_links_rels_parent_fk"
          FOREIGN KEY ("parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'footer_service_links_rels_pages_fk'
      ) THEN
        ALTER TABLE "footer_service_links_rels"
          ADD CONSTRAINT "footer_service_links_rels_pages_fk"
          FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'footer_service_links_rels_posts_fk'
      ) THEN
        ALTER TABLE "footer_service_links_rels"
          ADD CONSTRAINT "footer_service_links_rels_posts_fk"
          FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'footer_information_links_rels_parent_fk'
      ) THEN
        ALTER TABLE "footer_information_links_rels"
          ADD CONSTRAINT "footer_information_links_rels_parent_fk"
          FOREIGN KEY ("parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'footer_information_links_rels_pages_fk'
      ) THEN
        ALTER TABLE "footer_information_links_rels"
          ADD CONSTRAINT "footer_information_links_rels_pages_fk"
          FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'footer_information_links_rels_posts_fk'
      ) THEN
        ALTER TABLE "footer_information_links_rels"
          ADD CONSTRAINT "footer_information_links_rels_posts_fk"
          FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'footer_nav_items'
      ) THEN
        INSERT INTO "footer_information_links" ("_order", "_parent_id", "id", "link_type", "link_new_tab", "link_url", "link_label")
        SELECT
          "_order",
          "_parent_id",
          "id",
          "link_type"::text::"enum_footer_information_links_link_type",
          "link_new_tab",
          "link_url",
          "link_label"
        FROM "footer_nav_items"
        ON CONFLICT ("id") DO NOTHING;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'footer_rels'
      ) THEN
        INSERT INTO "footer_information_links_rels" ("order", "parent_id", "path", "pages_id", "posts_id")
        SELECT
          "order",
          "parent_id",
          regexp_replace("path", '^navItems\\.', 'informationLinks.'),
          "pages_id",
          "posts_id"
        FROM "footer_rels"
        WHERE "path" LIKE 'navItems.%';
      END IF;
    END $$;

    DROP TABLE IF EXISTS "footer_rels" CASCADE;
    DROP TABLE IF EXISTS "footer_nav_items" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_footer_nav_items_link_type";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      CREATE TYPE "public"."enum_footer_nav_items_link_type" AS ENUM('reference', 'custom');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "footer_nav_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "link_type" "enum_footer_nav_items_link_type" DEFAULT 'reference',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "footer_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "pages_id" integer,
      "posts_id" integer
    );

    CREATE INDEX IF NOT EXISTS "footer_nav_items_order_idx" ON "footer_nav_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "footer_nav_items_parent_id_idx" ON "footer_nav_items" USING btree ("_parent_id");

    CREATE INDEX IF NOT EXISTS "footer_rels_order_idx" ON "footer_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "footer_rels_parent_idx" ON "footer_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "footer_rels_path_idx" ON "footer_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "footer_rels_pages_id_idx" ON "footer_rels" USING btree ("pages_id");
    CREATE INDEX IF NOT EXISTS "footer_rels_posts_id_idx" ON "footer_rels" USING btree ("posts_id");

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'footer_nav_items_parent_id_fk'
      ) THEN
        ALTER TABLE "footer_nav_items"
          ADD CONSTRAINT "footer_nav_items_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'footer_rels_parent_fk'
      ) THEN
        ALTER TABLE "footer_rels"
          ADD CONSTRAINT "footer_rels_parent_fk"
          FOREIGN KEY ("parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'footer_rels_pages_fk'
      ) THEN
        ALTER TABLE "footer_rels"
          ADD CONSTRAINT "footer_rels_pages_fk"
          FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'footer_rels_posts_fk'
      ) THEN
        ALTER TABLE "footer_rels"
          ADD CONSTRAINT "footer_rels_posts_fk"
          FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'footer_information_links'
      ) THEN
        INSERT INTO "footer_nav_items" ("_order", "_parent_id", "id", "link_type", "link_new_tab", "link_url", "link_label")
        SELECT
          "_order",
          "_parent_id",
          "id",
          "link_type"::text::"enum_footer_nav_items_link_type",
          "link_new_tab",
          "link_url",
          "link_label"
        FROM "footer_information_links"
        ON CONFLICT ("id") DO NOTHING;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'footer_information_links_rels'
      ) THEN
        INSERT INTO "footer_rels" ("order", "parent_id", "path", "pages_id", "posts_id")
        SELECT
          "order",
          "parent_id",
          regexp_replace("path", '^informationLinks\\.', 'navItems.'),
          "pages_id",
          "posts_id"
        FROM "footer_information_links_rels"
        WHERE "path" LIKE 'informationLinks.%';
      END IF;
    END $$;

    DROP TABLE IF EXISTS "footer_information_links_rels" CASCADE;
    DROP TABLE IF EXISTS "footer_service_links_rels" CASCADE;
    DROP TABLE IF EXISTS "footer_about_links_rels" CASCADE;
    DROP TABLE IF EXISTS "footer_information_links" CASCADE;
    DROP TABLE IF EXISTS "footer_service_links" CASCADE;
    DROP TABLE IF EXISTS "footer_about_links" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_footer_information_links_link_type";
    DROP TYPE IF EXISTS "public"."enum_footer_service_links_link_type";
    DROP TYPE IF EXISTS "public"."enum_footer_about_links_link_type";
  `)
}
