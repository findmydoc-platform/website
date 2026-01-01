import * as migration_20251124_113216 from './20251124_113216';
import * as migration_20260101_230558_remove_pages_hero from './20260101_230558_remove_pages_hero';

export const migrations = [
  {
    up: migration_20251124_113216.up,
    down: migration_20251124_113216.down,
    name: '20251124_113216',
  },
  {
    up: migration_20260101_230558_remove_pages_hero.up,
    down: migration_20260101_230558_remove_pages_hero.down,
    name: '20260101_230558_remove_pages_hero'
  },
];
