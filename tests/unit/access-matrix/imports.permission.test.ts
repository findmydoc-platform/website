import { generatedCollectionAccess } from '@/plugins/generatedCollectionAccess'
import { makePermissionSuite } from './generatePermissionSuite'

makePermissionSuite('imports', { access: generatedCollectionAccess.imports })
