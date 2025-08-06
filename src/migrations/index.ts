import * as migration_20250806_160338_add_temporary_password_field from './20250806_160338_add_temporary_password_field'

export const migrations = [
  {
    up: migration_20250806_160338_add_temporary_password_field.up,
    down: migration_20250806_160338_add_temporary_password_field.down,
    name: '20250806_160338_add_temporary_password_field',
  },
]
