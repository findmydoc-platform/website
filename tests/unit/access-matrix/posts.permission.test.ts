import { Posts } from '@/collections/Posts'
import { makePermissionSuite } from './generatePermissionSuite'

makePermissionSuite('posts', Posts)
