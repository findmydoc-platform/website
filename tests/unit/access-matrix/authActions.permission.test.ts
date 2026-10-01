import { AuthActions } from '@/collections/AuthActions'
import { makePermissionSuite } from './generatePermissionSuite'

makePermissionSuite('authActions', AuthActions)
