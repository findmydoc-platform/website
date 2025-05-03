import * as migration_20250503_192052 from './20250503_192052';

export const migrations = [
  {
    up: migration_20250503_192052.up,
    down: migration_20250503_192052.down,
    name: '20250503_192052'
  },
];
