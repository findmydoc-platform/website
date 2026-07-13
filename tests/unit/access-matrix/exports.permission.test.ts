import { generatedCollectionAccess } from '@/plugins/generatedCollectionAccess'
import { makePermissionSuite } from './generatePermissionSuite'

makePermissionSuite('exports', { access: generatedCollectionAccess.exports })
