import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "auth_actions" ADD COLUMN "correlation_digest" varchar;
  ALTER TABLE "auth_actions" ADD COLUMN "correlation_key_version" varchar;
  CREATE INDEX "auth_actions_correlation_digest_idx" ON "auth_actions" USING btree ("correlation_digest");
  CREATE INDEX "auth_actions_correlation_key_version_idx" ON "auth_actions" USING btree ("correlation_key_version");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "auth_actions_correlation_digest_idx";
  DROP INDEX "auth_actions_correlation_key_version_idx";
  ALTER TABLE "auth_actions" DROP COLUMN "correlation_digest";
  ALTER TABLE "auth_actions" DROP COLUMN "correlation_key_version";`)
}
