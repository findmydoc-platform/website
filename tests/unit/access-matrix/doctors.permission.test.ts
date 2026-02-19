import { Doctors } from '@/collections/Doctors'
import { makePermissionSuite } from './generatePermissionSuite'

makePermissionSuite('doctors', Doctors)
