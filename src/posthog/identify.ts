import type { AuthData } from '@/auth/types/authTypes'
import { identifyPostHogActor, resolvePostHogActor, resetPostHogClientForTests } from './api'

export async function identifyUser(authData: AuthData): Promise<void> {
  const actor = await resolvePostHogActor({ authData })
  await identifyPostHogActor(actor)
}

export function resetIdentificationCache(): void {
  resetPostHogClientForTests()
}
