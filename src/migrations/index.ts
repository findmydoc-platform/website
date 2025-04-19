import * as migration_20250419_194950 from './20250419_194950';

export const migrations = [
  {
    up: migration_20250419_194950.up,
    down: migration_20250419_194950.down,
    name: '20250419_194950'
  },
];
