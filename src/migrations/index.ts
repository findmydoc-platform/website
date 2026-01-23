import * as migration_20260112_225205 from './20260112_225205'
import * as migration_20260120_202321_payload_mcp from './20260120_202321_payload_mcp'
import * as migration_20260121_075315_add_imports_collection from './20260121_075315_add_imports_collection'
import * as migration_20260123_101500_user_profile_media_drop_alt_caption from './20260123_101500_user_profile_media_drop_alt_caption'

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
]
