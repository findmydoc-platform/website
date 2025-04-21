import * as migration_20250421_225021 from './20250421_225021';
import * as migration_20250421_225246 from './20250421_225246';
import * as migration_20250421_225848 from './20250421_225848';

export const migrations = [
  {
    up: migration_20250421_225021.up,
    down: migration_20250421_225021.down,
    name: '20250421_225021',
  },
  {
    up: migration_20250421_225246.up,
    down: migration_20250421_225246.down,
    name: '20250421_225246',
  },
  {
    up: migration_20250421_225848.up,
    down: migration_20250421_225848.down,
    name: '20250421_225848'
  },
];
