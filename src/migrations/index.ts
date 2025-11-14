import * as migration_20250731_133127 from './20250731_133127'
import * as migration_20250808_052756_soft_delete_enablement from './20250808_052756_soft_delete_enablement'
import * as migration_20250821_191240_ui_components from './20250821_191240_ui_components'
import * as migration_20250918_205529_add_clinic_applications from './20250918_205529_add_clinic_applications'
import * as migration_20250922_070923_clinic_media from './20250922_070923_clinic_media'
import * as migration_20250925_200716_media_domain_cutover from './20250925_200716_media_domain_cutover'
import * as migration_20250929_154909_clinic_gallery from './20250929_154909_clinic_gallery'
import * as migration_20251010_115410_slugfield_upgrade from './20251010_115410_slugfield_upgrade'
import * as migration_20251015_200429_extend_search_collections from './20251015_200429_extend_search_collections'
import * as migration_20251114_103221_keyvalue_db from './20251114_103221_keyvalue_db'
import * as migration_20251114_105503_add_prefix_field_to_media_collections from './20251114_105503_add_prefix_field_to_media_collections'

export const migrations = [
  {
    up: migration_20250731_133127.up,
    down: migration_20250731_133127.down,
    name: '20250731_133127',
  },
  {
    up: migration_20250808_052756_soft_delete_enablement.up,
    down: migration_20250808_052756_soft_delete_enablement.down,
    name: '20250808_052756_soft_delete_enablement',
  },
  {
    up: migration_20250821_191240_ui_components.up,
    down: migration_20250821_191240_ui_components.down,
    name: '20250821_191240_ui_components',
  },
  {
    up: migration_20250918_205529_add_clinic_applications.up,
    down: migration_20250918_205529_add_clinic_applications.down,
    name: '20250918_205529_add_clinic_applications',
  },
  {
    up: migration_20250922_070923_clinic_media.up,
    down: migration_20250922_070923_clinic_media.down,
    name: '20250922_070923_clinic_media',
  },
  {
    up: migration_20250925_200716_media_domain_cutover.up,
    down: migration_20250925_200716_media_domain_cutover.down,
    name: '20250925_200716_media_domain_cutover',
  },
  {
    up: migration_20250929_154909_clinic_gallery.up,
    down: migration_20250929_154909_clinic_gallery.down,
    name: '20250929_154909_clinic_gallery',
  },
  {
    up: migration_20251010_115410_slugfield_upgrade.up,
    down: migration_20251010_115410_slugfield_upgrade.down,
    name: '20251010_115410_slugfield_upgrade',
  },
  {
    up: migration_20251015_200429_extend_search_collections.up,
    down: migration_20251015_200429_extend_search_collections.down,
    name: '20251015_200429_extend_search_collections',
  },
  {
    up: migration_20251114_103221_keyvalue_db.up,
    down: migration_20251114_103221_keyvalue_db.down,
    name: '20251114_103221',
  },
  {
    up: migration_20251114_105503_add_prefix_field_to_media_collections.up,
    down: migration_20251114_105503_add_prefix_field_to_media_collections.down,
    name: '20251114_105503_add_prefix_field_to_media_collections',
  },
]
