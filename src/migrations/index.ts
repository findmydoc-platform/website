import * as migration_20250330_200258 from './20250330_200258'

export const migrations = [
  {
    up: migration_20250330_200258.up,
    down: migration_20250330_200258.down,
    name: '20250330_200258',
  },
]
