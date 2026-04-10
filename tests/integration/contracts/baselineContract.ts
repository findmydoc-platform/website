import { expect } from 'vitest'

type ContractDocId = number | string

export interface BaselineContractOptions<TDoc> {
  collection: string
  createPrivileged: () => Promise<TDoc>
  getId: (doc: TDoc) => ContractDocId
  readPrivileged: (id: ContractDocId) => Promise<TDoc>
  updatePrivileged: (id: ContractDocId) => Promise<TDoc>
  assertUpdated: (doc: TDoc) => void
  assertDeniedWrite: (id: ContractDocId) => Promise<void>
  deletePrivileged: (id: ContractDocId) => Promise<unknown>
  deleteExpected?: 'allow' | 'deny'
}

/**
 * Shared baseline contract runner for collection integration tests.
 * Keeps CRUD + denied-write expectations consistent across collections.
 */
export async function runBaselineContract<TDoc>(options: BaselineContractOptions<TDoc>): Promise<void> {
  const created = await options.createPrivileged()
  const id = options.getId(created)

  expect(id).toBeDefined()

  const hydrated = await options.readPrivileged(id)
  expect(options.getId(hydrated)).toBe(id)

  const updated = await options.updatePrivileged(id)
  options.assertUpdated(updated)

  await options.assertDeniedWrite(id)

  const deleteExpected = options.deleteExpected ?? 'allow'
  if (deleteExpected === 'deny') {
    await expect(options.deletePrivileged(id)).rejects.toThrow()
    const stillThere = await options.readPrivileged(id)
    expect(options.getId(stillThere)).toBe(id)
    return
  }

  await options.deletePrivileged(id)
  await expect(options.readPrivileged(id)).rejects.toThrow()
}
