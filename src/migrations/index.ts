import * as migration_20250424_210117 from './20250424_210117';

export const migrations = [
  {
    up: migration_20250424_210117.up,
    down: migration_20250424_210117.down,
    name: '20250424_210117'
  },
];
