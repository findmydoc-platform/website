import { generatedCollectionAccess } from '@/security/generatedCollectionAccess'
import { makePermissionSuite } from './generatePermissionSuite'

makePermissionSuite('form-submissions', { access: generatedCollectionAccess['form-submissions'] })
