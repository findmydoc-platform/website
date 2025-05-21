import * as migration_20250515_084912 from './20250515_084912';
import * as migration_20250521_142706 from './20250521_142706';

export const migrations = [
  {
    up: migration_20250515_084912.up,
    down: migration_20250515_084912.down,
    name: '20250515_084912',
  },
  {
    up: migration_20250521_142706.up,
    down: migration_20250521_142706.down,
    name: '20250521_142706'
  },
];
