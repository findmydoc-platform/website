import * as migration_20250503_095129 from './20250503_095129';

export const migrations = [
  {
    up: migration_20250503_095129.up,
    down: migration_20250503_095129.down,
    name: '20250503_095129'
  },
];
