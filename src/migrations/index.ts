import * as migration_20250728_165318_add_clinic_staff_improvements from './20250728_165318_add_clinic_staff_improvements'

export const migrations = [
  {
    up: migration_20250728_165318_add_clinic_staff_improvements.up,
    down: migration_20250728_165318_add_clinic_staff_improvements.down,
    name: '20250728_165318_add_clinic_staff_improvements',
  },
]
