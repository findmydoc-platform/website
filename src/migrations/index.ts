import * as migration_20250711_222511 from './20250711_222511';

export const migrations = [
  {
    up: migration_20250711_222511.up,
    down: migration_20250711_222511.down,
    name: '20250711_222511'
  },
];
