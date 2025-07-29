import * as migration_20250729_062321 from './20250729_062321';

export const migrations = [
  {
    up: migration_20250729_062321.up,
    down: migration_20250729_062321.down,
    name: '20250729_062321'
  },
];
