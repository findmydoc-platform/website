import * as migration_20250731_133127 from './20250731_133127';
import * as migration_20250808_052756_soft_delete_enablement from './20250808_052756_soft_delete_enablement';
import * as migration_20250821_191240_ui_components from './20250821_191240_ui_components';
import * as migration_20250902_102445_tmp_password_basicusers from './20250902_102445_tmp_password_basicusers';

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
    up: migration_20250902_102445_tmp_password_basicusers.up,
    down: migration_20250902_102445_tmp_password_basicusers.down,
    name: '20250902_102445_tmp_password_basicusers'
  },
];
