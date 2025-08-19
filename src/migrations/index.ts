import * as migration_20250731_133127 from './20250731_133127';
import * as migration_20250808_052756_soft_delete_enablement from './20250808_052756_soft_delete_enablement';
import * as migration_20250819_064904_ui_blocks_phase1 from './20250819_064904_ui_blocks_phase1';

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
    up: migration_20250819_064904_ui_blocks_phase1.up,
    down: migration_20250819_064904_ui_blocks_phase1.down,
    name: '20250819_064904_ui_blocks_phase1'
  },
];
