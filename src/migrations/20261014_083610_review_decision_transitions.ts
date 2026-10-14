import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_review_decision_transitions_workflow_kind" AS ENUM('response', 'appeal');
  CREATE TYPE "public"."enum_review_decision_transitions_event_type" AS ENUM('clinic_response_decided', 'review_appeal_decided');
  CREATE TYPE "public"."enum_review_decision_transitions_outcome" AS ENUM('approved', 'rejected', 'blocked', 'upheld');
  CREATE TABLE "review_decision_transitions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"transition_id" varchar NOT NULL,
  	"review_id" varchar NOT NULL,
  	"clinic_scope_id" varchar NOT NULL,
  	"workflow_kind" "enum_review_decision_transitions_workflow_kind" NOT NULL,
  	"workflow_id" varchar NOT NULL,
  	"event_type" "enum_review_decision_transitions_event_type" NOT NULL,
  	"outcome" "enum_review_decision_transitions_outcome" NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "review_decision_transitions_id" integer;
  CREATE UNIQUE INDEX "review_decision_transitions_transition_id_idx" ON "review_decision_transitions" USING btree ("transition_id");
  CREATE INDEX "review_decision_transitions_review_id_idx" ON "review_decision_transitions" USING btree ("review_id");
  CREATE INDEX "review_decision_transitions_clinic_scope_id_idx" ON "review_decision_transitions" USING btree ("clinic_scope_id");
  CREATE INDEX "review_decision_transitions_workflow_id_idx" ON "review_decision_transitions" USING btree ("workflow_id");
  CREATE INDEX "review_decision_transitions_updated_at_idx" ON "review_decision_transitions" USING btree ("updated_at");
  CREATE INDEX "review_decision_transitions_created_at_idx" ON "review_decision_transitions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_review_decision_transitions_fk" FOREIGN KEY ("review_decision_transitions_id") REFERENCES "public"."review_decision_transitions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_review_decision_transition_idx" ON "payload_locked_documents_rels" USING btree ("review_decision_transitions_id");`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Preserve immutable decision evidence on application rollback. A later contract migration owns removal.
}
