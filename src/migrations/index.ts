import * as migration_20250224_215508 from './20250224_215508';
import * as migration_20250322_221350 from './20250322_221350';

export const migrations = [
  {
    up: migration_20250224_215508.up,
    down: migration_20250224_215508.down,
    name: '20250224_215508',
  },
  {
    up: migration_20250322_221350.up,
    down: migration_20250322_221350.down,
    name: '20250322_221350'
  },
];
