import { TransactionalEmailEvents } from '@/collections/TransactionalEmailEvents'
import { makePermissionSuite } from './generatePermissionSuite'

makePermissionSuite('transactionalEmailEvents', TransactionalEmailEvents)
