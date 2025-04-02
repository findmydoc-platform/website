import * as migration_20250330_201946 from './20250330_201946';

export const migrations = [
  {
    up: migration_20250330_201946.up,
    down: migration_20250330_201946.down,
    name: '20250330_201946'
  },
];
