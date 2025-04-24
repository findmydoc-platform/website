import * as migration_20250424_202615 from './20250424_202615';

export const migrations = [
  {
    up: migration_20250424_202615.up,
    down: migration_20250424_202615.down,
    name: '20250424_202615'
  },
];
