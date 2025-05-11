import * as migration_20250511_204232 from './20250511_204232';

export const migrations = [
  {
    up: migration_20250511_204232.up,
    down: migration_20250511_204232.down,
    name: '20250511_204232'
  },
];
