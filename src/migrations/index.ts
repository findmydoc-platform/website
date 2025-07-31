import * as migration_20250128_add_slug_to_forms from './20250128_add_slug_to_forms'
import * as migration_20250729_065853 from './20250729_065853'

export const migrations = [
  {
    up: migration_20250729_065853.up,
    down: migration_20250729_065853.down,
    name: '20250729_065853',
  },
  {
    up: migration_20250128_add_slug_to_forms.up,
    down: migration_20250128_add_slug_to_forms.down,
    name: '20250128_add_slug_to_forms',
  },
]
