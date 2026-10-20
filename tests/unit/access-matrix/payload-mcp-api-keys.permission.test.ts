import { generatedCollectionAccess } from '@/security/generatedCollectionAccess'
import { makePermissionSuite } from './generatePermissionSuite'

makePermissionSuite('payload-mcp-api-keys', { access: generatedCollectionAccess['payload-mcp-api-keys'] })
