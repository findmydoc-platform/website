import * as migration_20250424_210117 from './20250424_210117';
import * as migration_20250425_080939 from './20250425_080939';

export const migrations = [
  {
    up: migration_20250424_210117.up,
    down: migration_20250424_210117.down,
    name: '20250424_210117',
  },
  {
    up: migration_20250425_080939.up,
    down: migration_20250425_080939.down,
    name: '20250425_080939'
  },
];
