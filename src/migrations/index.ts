import * as migration_20250731_133127 from './20250731_133127';
import * as migration_20250808_052756_soft_delete_enablement from './20250808_052756_soft_delete_enablement';

export const migrations = [
  {
    up: migration_20250731_133127.up,
    down: migration_20250731_133127.down,
    name: '20250731_133127',
  },
  {
    up: migration_20250808_052756_soft_delete_enablement.up,
    down: migration_20250808_052756_soft_delete_enablement.down,
    name: '20250808_052756_soft_delete_enablement'
  },
];
