import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "clinics_create" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "clinics_update" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "doctors_create" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "doctors_update" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "clinic_media_find" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "doctor_media_find" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "clinictreatments_create" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "clinictreatments_update" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "doctortreatments_create" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "doctortreatments_update" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "doctorspecialties_create" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "doctorspecialties_update" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_create_clinic_profile" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_trash_clinic" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_trash_doctor" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_delete_clinic_treatment" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_delete_doctor_treatment" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_delete_doctor_specialty" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_publish_clinic_gallery_image" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_upload_clinic_gallery_image" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_upload_doctor_image" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_update_doctor_image" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_delete_clinic_image" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_delete_doctor_image" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_read_clinic_gallery" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_save_clinic_gallery" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "clinics_create";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "clinics_update";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "doctors_create";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "doctors_update";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "clinic_media_find";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "doctor_media_find";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "clinictreatments_create";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "clinictreatments_update";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "doctortreatments_create";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "doctortreatments_update";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "doctorspecialties_create";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "doctorspecialties_update";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_create_clinic_profile";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_trash_clinic";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_trash_doctor";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_delete_clinic_treatment";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_delete_doctor_treatment";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_delete_doctor_specialty";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_publish_clinic_gallery_image";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_upload_clinic_gallery_image";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_upload_doctor_image";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_update_doctor_image";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_delete_clinic_image";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_delete_doctor_image";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_read_clinic_gallery";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_save_clinic_gallery";`)
}
