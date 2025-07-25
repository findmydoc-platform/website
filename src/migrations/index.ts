import * as migration_20250706_213058 from './20250706_213058'

export const migrations = [
  {
    up: migration_20250706_213058.up,
    down: migration_20250706_213058.down,
    name: '20250706_213058',
  },
]
