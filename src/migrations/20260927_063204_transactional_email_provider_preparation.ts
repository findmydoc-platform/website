import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "transactional_email_outbox" ADD COLUMN "prepared_provider_request" varchar;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "provider_team_id" varchar;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "provider_project_id" varchar;
  ALTER TABLE "transactional_email_outbox" ADD COLUMN "provider_route_id" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "transactional_email_outbox" DROP COLUMN "prepared_provider_request";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "provider_team_id";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "provider_project_id";
  ALTER TABLE "transactional_email_outbox" DROP COLUMN "provider_route_id";`)
}
