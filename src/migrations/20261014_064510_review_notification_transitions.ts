import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_review_publication_transitions_event_type" AS ENUM('review_published', 'review_withdrawn', 'review_removed');
  CREATE TABLE "review_publication_transitions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"transition_id" varchar NOT NULL,
  	"review_id" varchar NOT NULL,
  	"clinic_scope_id" varchar NOT NULL,
  	"event_type" "enum_review_publication_transitions_event_type" NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "reviews" ADD COLUMN "notification_publication_evidence_at" timestamp(3) with time zone;
  ALTER TABLE "reviews" ADD COLUMN "notification_transition" jsonb;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_notification_publication_evidence_at" timestamp(3) with time zone;
  ALTER TABLE "_reviews_v" ADD COLUMN "version_notification_transition" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "review_publication_transitions_id" integer;
  CREATE UNIQUE INDEX "review_publication_transitions_transition_id_idx" ON "review_publication_transitions" USING btree ("transition_id");
  CREATE INDEX "review_publication_transitions_review_id_idx" ON "review_publication_transitions" USING btree ("review_id");
  CREATE INDEX "review_publication_transitions_clinic_scope_id_idx" ON "review_publication_transitions" USING btree ("clinic_scope_id");
  CREATE INDEX "review_publication_transitions_updated_at_idx" ON "review_publication_transitions" USING btree ("updated_at");
  CREATE INDEX "review_publication_transitions_created_at_idx" ON "review_publication_transitions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_review_publication_transiti_fk" FOREIGN KEY ("review_publication_transitions_id") REFERENCES "public"."review_publication_transitions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_review_publication_transit_idx" ON "payload_locked_documents_rels" USING btree ("review_publication_transitions_id");`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Preserve additive source evidence on application rollback. A later contract migration owns removal.
}
