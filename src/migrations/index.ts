import * as migration_20250711_222511 from './20250711_222511';
import * as migration_20250721_212428_phase_1_security_fixes from './20250721_212428_phase_1_security_fixes';

export const migrations = [
  {
    up: migration_20250711_222511.up,
    down: migration_20250711_222511.down,
    name: '20250711_222511',
  },
  {
    up: migration_20250721_212428_phase_1_security_fixes.up,
    down: migration_20250721_212428_phase_1_security_fixes.down,
    name: '20250721_212428_phase_1_security_fixes'
  },
];
