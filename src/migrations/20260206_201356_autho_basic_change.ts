import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts_rels" RENAME COLUMN "platform_staff_id" TO "basic_users_id";
  ALTER TABLE "_posts_v_rels" RENAME COLUMN "platform_staff_id" TO "basic_users_id";
  ALTER TABLE "posts_rels" DROP CONSTRAINT "posts_rels_platform_staff_fk";
  
  ALTER TABLE "_posts_v_rels" DROP CONSTRAINT "_posts_v_rels_platform_staff_fk";
  
  DROP INDEX "posts_rels_platform_staff_id_idx";
  DROP INDEX "_posts_v_rels_platform_staff_id_idx";
  ALTER TABLE "user_profile_media" ADD COLUMN "stable_id" varchar;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_basic_users_fk" FOREIGN KEY ("basic_users_id") REFERENCES "public"."basic_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_basic_users_fk" FOREIGN KEY ("basic_users_id") REFERENCES "public"."basic_users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_rels_basic_users_id_idx" ON "posts_rels" USING btree ("basic_users_id");
  CREATE INDEX "_posts_v_rels_basic_users_id_idx" ON "_posts_v_rels" USING btree ("basic_users_id");
  CREATE UNIQUE INDEX "user_profile_media_stable_id_idx" ON "user_profile_media" USING btree ("stable_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts_rels" RENAME COLUMN "basic_users_id" TO "platform_staff_id";
  ALTER TABLE "_posts_v_rels" RENAME COLUMN "basic_users_id" TO "platform_staff_id";
  ALTER TABLE "posts_rels" DROP CONSTRAINT "posts_rels_basic_users_fk";
  
  ALTER TABLE "_posts_v_rels" DROP CONSTRAINT "_posts_v_rels_basic_users_fk";
  
  DROP INDEX "posts_rels_basic_users_id_idx";
  DROP INDEX "_posts_v_rels_basic_users_id_idx";
  DROP INDEX "user_profile_media_stable_id_idx";
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_platform_staff_fk" FOREIGN KEY ("platform_staff_id") REFERENCES "public"."platform_staff"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_rels_platform_staff_id_idx" ON "posts_rels" USING btree ("platform_staff_id");
  CREATE INDEX "_posts_v_rels_platform_staff_id_idx" ON "_posts_v_rels" USING btree ("platform_staff_id");
  ALTER TABLE "user_profile_media" DROP COLUMN "stable_id";`)
}
