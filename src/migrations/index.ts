import * as migration_20250512_203445 from './20250512_203445';

export const migrations = [
  {
    up: migration_20250512_203445.up,
    down: migration_20250512_203445.down,
    name: '20250512_203445'
  },
];
