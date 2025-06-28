import * as migration_20250624_200421 from './20250624_200421'
import * as migration_20250628_074751_add_average_rating_fields from './20250628_074751_add_average_rating_fields'

export const migrations = [
  {
    up: migration_20250624_200421.up,
    down: migration_20250624_200421.down,
    name: '20250624_200421',
  },
  {
    up: migration_20250628_074751_add_average_rating_fields.up,
    down: migration_20250628_074751_add_average_rating_fields.down,
    name: '20250628_074751_add_average_rating_fields',
  },
]
