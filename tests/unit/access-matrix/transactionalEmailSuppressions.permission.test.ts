import { TransactionalEmailSuppressions } from '@/collections/TransactionalEmailSuppressions'
import { makePermissionSuite } from './generatePermissionSuite'

makePermissionSuite('transactionalEmailSuppressions', TransactionalEmailSuppressions)
