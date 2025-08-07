import * as migration_20250731_133127 from './20250731_133127';

export const migrations = [
  {
    up: migration_20250731_133127.up,
    down: migration_20250731_133127.down,
    name: '20250731_133127'
  },
];
