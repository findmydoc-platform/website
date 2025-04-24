import * as migration_20250421_234812 from './20250421_234812';
import * as migration_20250424_193057 from './20250424_193057';
import * as migration_20250424_193619 from './20250424_193619';

export const migrations = [
  {
    up: migration_20250421_234812.up,
    down: migration_20250421_234812.down,
    name: '20250421_234812',
  },
  {
    up: migration_20250424_193057.up,
    down: migration_20250424_193057.down,
    name: '20250424_193057',
  },
  {
    up: migration_20250424_193619.up,
    down: migration_20250424_193619.down,
    name: '20250424_193619'
  },
];
