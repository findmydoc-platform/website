import type { WorkerClaim } from './worker'

export const schedulerInvocationBudgetMilliseconds = 240_000
export const schedulerAttemptAndResultBudgetMilliseconds = 25_000

type SchedulerPorts = {
  sweep(mayContinue: () => boolean): Promise<boolean>
  candidates(afterId: number): Promise<number[]>
  claim(id: number, mayClaim: () => boolean): Promise<WorkerClaim | null>
  processClaim(claim: WorkerClaim): Promise<void>
}

export async function runBoundedTransactionalEmailWorker(
  ports: SchedulerPorts,
  now: () => number = Date.now,
): Promise<{ claimed: number }> {
  const deadline = now() + schedulerInvocationBudgetMilliseconds
  const mayClaim = () => deadline - now() > schedulerAttemptAndResultBudgetMilliseconds
  const maySweep = () => deadline - now() > 2 * schedulerAttemptAndResultBudgetMilliseconds
  if (!(await ports.sweep(maySweep))) return { claimed: 0 }

  let afterId = 0
  let candidates: number[] = []
  let claimed = 0
  let failure: unknown
  const inFlight = new Set<Promise<void>>()

  while (claimed < 5 && mayClaim() && !failure) {
    if (inFlight.size === 2) await Promise.race(inFlight)
    if (!mayClaim() || failure) break
    if (!candidates.length) {
      candidates = await ports.candidates(afterId)
      if (!candidates.length) break
    }
    const id = candidates.shift()!
    afterId = id
    if (!mayClaim()) break
    const claim = await ports.claim(id, mayClaim)
    if (!claim) continue
    claimed += 1
    const task = ports.processClaim(claim).catch((error: unknown) => {
      failure ??= error
    })
    inFlight.add(task)
    void task.finally(() => inFlight.delete(task))
  }

  await Promise.all(inFlight)
  if (failure) throw failure
  return { claimed }
}
