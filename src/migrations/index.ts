import * as migration_20250419_144032 from './20250419_144032'

export const migrations = [
  {
    up: migration_20250419_144032.up,
    down: migration_20250419_144032.down,
    name: '20250419_144032',
  },
]
