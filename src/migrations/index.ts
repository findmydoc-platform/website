import * as migration_20250420_213625 from './20250420_213625';

export const migrations = [
  {
    up: migration_20250420_213625.up,
    down: migration_20250420_213625.down,
    name: '20250420_213625'
  },
];
