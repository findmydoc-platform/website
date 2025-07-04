import * as migration_20250704_060354 from './20250704_060354';

export const migrations = [
  {
    up: migration_20250704_060354.up,
    down: migration_20250704_060354.down,
    name: '20250704_060354'
  },
];
