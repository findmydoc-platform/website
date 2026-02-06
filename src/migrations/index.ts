import * as migration_20260112_225205 from './20260112_225205';
import * as migration_20260120_202321_payload_mcp from './20260120_202321_payload_mcp';
import * as migration_20260121_075315_add_imports_collection from './20260121_075315_add_imports_collection';
import * as migration_20260123_101500_user_profile_media_drop_alt_caption from './20260123_101500_user_profile_media_drop_alt_caption';
import * as migration_20260126_144212_import_plugin from './20260126_144212_import_plugin';
import * as migration_20260206_103034_compliance_blog_schema from './20260206_103034_compliance_blog_schema';
import * as migration_20260206_201356_autho_basic_change from './20260206_201356_autho_basic_change';

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
    name: '20260206_201356_autho_basic_change'
  },
];
