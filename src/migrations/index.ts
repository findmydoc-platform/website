import * as migration_20250630_193735 from './20250630_193735';

export const migrations = [
  {
    up: migration_20250630_193735.up,
    down: migration_20250630_193735.down,
    name: '20250630_193735'
  },
];
