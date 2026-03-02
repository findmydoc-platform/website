import * as migration_20260112_225205 from './20260112_225205'
import * as migration_20260120_202321_payload_mcp from './20260120_202321_payload_mcp'
import * as migration_20260121_075315_add_imports_collection from './20260121_075315_add_imports_collection'
import * as migration_20260123_101500_user_profile_media_drop_alt_caption from './20260123_101500_user_profile_media_drop_alt_caption'
import * as migration_20260126_144212_import_plugin from './20260126_144212_import_plugin'
import * as migration_20260206_103034_compliance_blog_schema from './20260206_103034_compliance_blog_schema'
import * as migration_20260206_201356_autho_basic_change from './20260206_201356_autho_basic_change'
import * as migration_20260206_201500_header_nav_sub_items from './20260206_201500_header_nav_sub_items'
import * as migration_20260210_141228_add_clinic_verification_tier from './20260210_141228_add_clinic_verification_tier'
import * as migration_20260212_224719_add_clinic_media_stable_id from './20260212_224719_add_clinic_media_stable_id'
import * as migration_20260214_105223_header_footer_nav_groups from './20260214_105223_header_footer_nav_groups'
import * as migration_20260216_085324_rename_medical_specialties_feature_image from './20260216_085324_rename_medical_specialties_feature_image'
import * as migration_20260223_212423_nested_docs_medical_specialties from './20260223_212423_nested_docs_medical_specialties'
import * as migration_20260302_102254_ci_schema_alignment from './20260302_102254_ci_schema_alignment'
import * as migration_20260302_214556_clinic_nullable_and_import_slug_enum from './20260302_214556_clinic_nullable_and_import_slug_enum'

export const migrations = [
  {
    up: migration_20260112_225205.up,
    down: migration_20260112_225205.down,
    name: '20260112_225205',
  },
  {
    up: migration_20260120_202321_payload_mcp.up,
    down: migration_20260120_202321_payload_mcp.down,
    name: '20260120_202321_payload_mcp',
  },
  {
    up: migration_20260121_075315_add_imports_collection.up,
    down: migration_20260121_075315_add_imports_collection.down,
    name: '20260121_075315_add_imports_collection',
  },
  {
    up: migration_20260123_101500_user_profile_media_drop_alt_caption.up,
    down: migration_20260123_101500_user_profile_media_drop_alt_caption.down,
    name: '20260123_101500_user_profile_media_drop_alt_caption',
  },
  {
    up: migration_20260126_144212_import_plugin.up,
    down: migration_20260126_144212_import_plugin.down,
    name: '20260126_144212_import_plugin',
  },
  {
    up: migration_20260206_103034_compliance_blog_schema.up,
    down: migration_20260206_103034_compliance_blog_schema.down,
    name: '20260206_103034_compliance_blog_schema',
  },
  {
    up: migration_20260206_201356_autho_basic_change.up,
    down: migration_20260206_201356_autho_basic_change.down,
    name: '20260206_201356_autho_basic_change',
  },
  {
    up: migration_20260206_201500_header_nav_sub_items.up,
    down: migration_20260206_201500_header_nav_sub_items.down,
    name: '20260206_201500_header_nav_sub_items',
  },
  {
    up: migration_20260210_141228_add_clinic_verification_tier.up,
    down: migration_20260210_141228_add_clinic_verification_tier.down,
    name: '20260210_141228_add_clinic_verification_tier',
  },
  {
    up: migration_20260212_224719_add_clinic_media_stable_id.up,
    down: migration_20260212_224719_add_clinic_media_stable_id.down,
    name: '20260212_224719_add_clinic_media_stable_id',
  },
  {
    up: migration_20260214_105223_header_footer_nav_groups.up,
    down: migration_20260214_105223_header_footer_nav_groups.down,
    name: '20260214_105223_header_footer_nav_groups',
  },
  {
    up: migration_20260216_085324_rename_medical_specialties_feature_image.up,
    down: migration_20260216_085324_rename_medical_specialties_feature_image.down,
    name: '20260216_085324_rename_medical_specialties_feature_image',
  },
  {
    up: migration_20260223_212423_nested_docs_medical_specialties.up,
    down: migration_20260223_212423_nested_docs_medical_specialties.down,
    name: '20260223_212423_nested_docs_medical_specialties',
  },
  {
    up: migration_20260302_102254_ci_schema_alignment.up,
    down: migration_20260302_102254_ci_schema_alignment.down,
    name: '20260302_102254_ci_schema_alignment',
  },
  {
    up: migration_20260302_214556_clinic_nullable_and_import_slug_enum.up,
    down: migration_20260302_214556_clinic_nullable_and_import_slug_enum.down,
    name: '20260302_214556_clinic_nullable_and_import_slug_enum',
  },
]
