import * as migration_20250630_211210 from './20250630_211210';

export const migrations = [
  {
    up: migration_20250630_211210.up,
    down: migration_20250630_211210.down,
    name: '20250630_211210'
  },
];
