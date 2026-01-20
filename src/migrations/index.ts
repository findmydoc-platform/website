import * as migration_20260112_225205 from './20260112_225205';
import * as migration_20260120_143832_payload_mcp from './20260120_143832_payload_mcp';

export const migrations = [
  {
    up: migration_20260112_225205.up,
    down: migration_20260112_225205.down,
    name: '20260112_225205',
  },
  {
    up: migration_20260120_143832_payload_mcp.up,
    down: migration_20260120_143832_payload_mcp.down,
    name: '20260120_143832_payload_mcp'
  },
];
