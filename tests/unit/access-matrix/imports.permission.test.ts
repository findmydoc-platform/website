import { generatedCollectionAccess } from '@/security/generatedCollectionAccess'
import { makePermissionSuite } from './generatePermissionSuite'

makePermissionSuite('imports', { access: generatedCollectionAccess.imports })
