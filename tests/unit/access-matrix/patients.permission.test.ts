import { Patients } from '@/collections/Patients'
import { makePermissionSuite } from './generatePermissionSuite'

makePermissionSuite('patients', Patients)
