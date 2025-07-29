import * as migration_20250711_222511 from './20250711_222511';
import * as migration_20250128_add_slug_to_forms from './20250128_add_slug_to_forms';

export const migrations = [
  {
    up: migration_20250711_222511.up,
    down: migration_20250711_222511.down,
    name: '20250711_222511'
  },
  {
    up: migration_20250128_add_slug_to_forms.up,
    down: migration_20250128_add_slug_to_forms.down,
    name: '20250128_add_slug_to_forms'
  },
];
