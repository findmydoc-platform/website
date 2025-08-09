import * as migration_20250809_082750 from './20250809_082750';

export const migrations = [
  {
    up: migration_20250809_082750.up,
    down: migration_20250809_082750.down,
    name: '20250809_082750'
  },
];
