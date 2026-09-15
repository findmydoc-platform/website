import { TransactionalEmailOutbox } from '@/collections/TransactionalEmailOutbox'
import { makePermissionSuite } from './generatePermissionSuite'

makePermissionSuite('transactionalEmailOutbox', TransactionalEmailOutbox)
