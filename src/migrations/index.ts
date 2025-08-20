import * as migration_20250820_062019 from './20250820_062019'

export const migrations = [
  {
    up: migration_20250820_062019.up,
    down: migration_20250820_062019.down,
    name: '20250820_062019',
  },
]
