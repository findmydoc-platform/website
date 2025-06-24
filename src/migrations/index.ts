import * as migration_20250624_200421 from './20250624_200421';

export const migrations = [
  {
    up: migration_20250624_200421.up,
    down: migration_20250624_200421.down,
    name: '20250624_200421'
  },
];
