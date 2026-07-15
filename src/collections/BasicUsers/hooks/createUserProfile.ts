import type { CollectionAfterChangeHook } from 'payload'
import type { BasicUser } from '@/payload-types'

// Legacy BasicUsers is locked during the expand/switch window. Staff provisioning is direct.
export const createUserProfileHook: CollectionAfterChangeHook<BasicUser> = ({ doc }) => doc
