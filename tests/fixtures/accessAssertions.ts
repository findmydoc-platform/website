import { expect } from 'vitest'

interface DeniedCrudScenario {
  create?: () => Promise<unknown>
  update?: () => Promise<unknown>
  delete?: () => Promise<unknown>
}

const expectDenied = async (operation: (() => Promise<unknown>) | undefined) => {
  if (!operation) return
  await expect(operation()).rejects.toThrow()
}

export async function assertDeniedCrud(scenarios: DeniedCrudScenario[]): Promise<void> {
  for (const scenario of scenarios) {
    await expectDenied(scenario.create)
    await expectDenied(scenario.update)
    await expectDenied(scenario.delete)
  }
}
