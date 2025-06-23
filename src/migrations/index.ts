import * as migration_20250616_211706 from './20250616_211706';

export const migrations = [
  {
    up: migration_20250616_211706.up,
    down: migration_20250616_211706.down,
    name: '20250616_211706'
  },
];
