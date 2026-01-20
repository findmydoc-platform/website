import * as migration_20260112_225205 from './20260112_225205';
import * as migration_20260120_202321_payload_mcp from './20260120_202321_payload_mcp';
import * as migration_20260120_220649_add_imports_collection from './20260120_220649_add_imports_collection';

export const migrations = [
  {
    up: migration_20260112_225205.up,
    down: migration_20260112_225205.down,
    name: '20260112_225205',
  },
  {
    up: migration_20260120_202321_payload_mcp.up,
    down: migration_20260120_202321_payload_mcp.down,
    name: '20260120_202321_payload_mcp'
  },
  {
    up: migration_20260120_220649_add_imports_collection.up,
    down: migration_20260120_220649_add_imports_collection.down,
    name: '20260120_220649_add_imports_collection'
  },
];
