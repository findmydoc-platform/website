import { generatedCollectionAccess } from '@/security/generatedCollectionAccess'
import { makePermissionSuite } from './generatePermissionSuite'

makePermissionSuite('redirects', { access: generatedCollectionAccess.redirects })
