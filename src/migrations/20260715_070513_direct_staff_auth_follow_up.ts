import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $migration$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM "payload_mcp_api_keys" AS api_key
      LEFT JOIN "platform_staff" AS principal ON principal."user_id" = api_key."user_id"
      WHERE principal."id" IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot remap every MCP API key owner from basicUsers to platformStaff';
    END IF;
  END
  $migration$;

  ALTER TABLE "payload_mcp_api_keys" DROP CONSTRAINT "payload_mcp_api_keys_user_id_basic_users_id_fk";

  UPDATE "payload_mcp_api_keys" AS api_key
  SET "user_id" = principal."id"
  FROM "platform_staff" AS principal
  WHERE principal."user_id" = api_key."user_id";
  
  ALTER TABLE "payload_mcp_api_keys" ADD CONSTRAINT "payload_mcp_api_keys_user_id_platform_staff_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."platform_staff"("id") ON DELETE set null ON UPDATE no action;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DO $migration$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM "payload_mcp_api_keys" AS api_key
      LEFT JOIN "platform_staff" AS principal ON principal."id" = api_key."user_id"
      LEFT JOIN "basic_users" AS legacy_user ON legacy_user."id" = principal."user_id"
      WHERE legacy_user."id" IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot remap every MCP API key owner from platformStaff to basicUsers';
    END IF;
  END
  $migration$;

  ALTER TABLE "payload_mcp_api_keys" DROP CONSTRAINT "payload_mcp_api_keys_user_id_platform_staff_id_fk";

  UPDATE "payload_mcp_api_keys" AS api_key
  SET "user_id" = principal."user_id"
  FROM "platform_staff" AS principal
  WHERE principal."id" = api_key."user_id";
  
  ALTER TABLE "payload_mcp_api_keys" ADD CONSTRAINT "payload_mcp_api_keys_user_id_basic_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."basic_users"("id") ON DELETE set null ON UPDATE no action;`)
}
