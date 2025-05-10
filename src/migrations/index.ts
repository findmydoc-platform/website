import * as migration_20250510_193909 from './20250510_193909';

export const migrations = [
  {
    up: migration_20250510_193909.up,
    down: migration_20250510_193909.down,
    name: '20250510_193909'
  },
];
