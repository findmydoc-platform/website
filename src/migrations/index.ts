import * as migration_20250502_171323 from './20250502_171323';

export const migrations = [
  {
    up: migration_20250502_171323.up,
    down: migration_20250502_171323.down,
    name: '20250502_171323'
  },
];
