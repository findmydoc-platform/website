import * as migration_20250731_133127 from './20250731_133127';
import * as migration_20250808_052756_soft_delete_enablement from './20250808_052756_soft_delete_enablement';
import * as migration_20250821_191240_ui_components from './20250821_191240_ui_components';
import * as migration_20250918_205529_add_clinic_applications from './20250918_205529_add_clinic_applications';
import * as migration_20250922_070923_clinic_media from './20250922_070923_clinic_media';

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
    name: '20250922_070923_clinic_media'
  },
];
