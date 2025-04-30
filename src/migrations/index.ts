import * as migration_20250426_102002 from './20250426_102002'

export const migrations = [
  {
    up: migration_20250426_102002.up,
    down: migration_20250426_102002.down,
    name: '20250426_102002',
  },
]
