import { generatedCollectionAccess } from '@/security/generatedCollectionAccess'
import { makePermissionSuite } from './generatePermissionSuite'

makePermissionSuite('exports', { access: generatedCollectionAccess.exports })
