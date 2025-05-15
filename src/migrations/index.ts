import * as migration_20250515_084912 from './20250515_084912';

export const migrations = [
  {
    up: migration_20250515_084912.up,
    down: migration_20250515_084912.down,
    name: '20250515_084912'
  },
];
