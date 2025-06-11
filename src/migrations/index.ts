import * as migration_20250611_182106 from './20250611_182106';

export const migrations = [
  {
    up: migration_20250611_182106.up,
    down: migration_20250611_182106.down,
    name: '20250611_182106'
  },
];
