import * as migration_20250613_104148 from './20250613_104148';

export const migrations = [
  {
    up: migration_20250613_104148.up,
    down: migration_20250613_104148.down,
    name: '20250613_104148'
  },
];
