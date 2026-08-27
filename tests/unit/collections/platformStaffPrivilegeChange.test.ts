import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { guardPlatformStaffRoleChange } from '@/collections/PlatformStaff/hooks/guardRoleChange'

const args = ({
  actor,
  capabilities,
  context,
}: {
  actor?: { id: number; role: 'admin' | 'support' }
  capabilities: string[]
  context?: Record<string, unknown>
}) =>
  ({
    collection: null,
    context: {},
    data: { capabilities, role: 'support' },
    operation: 'update',
    originalDoc: { capabilities: [], id: 2, role: 'support' },
    req: {
      context: context ?? {},
      payload: { findByID: vi.fn().mockResolvedValue({ role: actor?.role }) },
      user: actor ? { collection: 'platformStaff', id: actor.id } : undefined,
    } as unknown as PayloadRequest,
  }) as never

describe('platform staff privilege changes', () => {
  it('blocks self-granting conversation moderation while allowing a separate admin or trusted provisioning path', async () => {
    await expect(
      guardPlatformStaffRoleChange(
        args({ actor: { id: 2, role: 'admin' }, capabilities: ['conversation-moderation'] }),
      ),
    ).rejects.toThrow('may not change their own privileges')

    await expect(
      guardPlatformStaffRoleChange(
        args({ actor: { id: 1, role: 'admin' }, capabilities: ['conversation-moderation'] }),
      ),
    ).resolves.toMatchObject({ capabilities: ['conversation-moderation'] })

    await expect(
      guardPlatformStaffRoleChange(
        args({ capabilities: ['conversation-moderation'], context: { trustedPlatformStaffOps: true } }),
      ),
    ).resolves.toMatchObject({ capabilities: ['conversation-moderation'] })
  })
})
