import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_auth_actions_locale" AS ENUM('de', 'en');
  ALTER TABLE "auth_actions" ADD COLUMN "locale" "enum_auth_actions_locale";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "auth_actions" DROP COLUMN "locale";
  DROP TYPE "public"."enum_auth_actions_locale";`)
}
