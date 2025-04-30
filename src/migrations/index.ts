import * as migration_20250429_210634 from './20250429_210634';
import * as migration_20250430_180140 from './20250430_180140';

export const migrations = [
  {
    up: migration_20250429_210634.up,
    down: migration_20250429_210634.down,
    name: '20250429_210634',
  },
  {
    up: migration_20250430_180140.up,
    down: migration_20250430_180140.down,
    name: '20250430_180140'
  },
];
