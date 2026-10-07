import { validateInput } from './common.mjs'

// This exception covers the route module itself, not its imported backend services.
const BACKEND_ONLY_ROUTE = 'src/app/api/internal/transactional-email/worker/route.ts'

export function selectStorybook(input) {
  const { valid, changes, reason } = validateInput(input)
  const result = (mode, reasons) => ({ mode, files: [], lanes: [], reasons, shadowFiles: [] })

  if (!valid) return result('full', [reason])

  const requiresFull = changes.find(
    (change) => change.status !== 'M' || change.previousPath !== undefined || change.path !== BACKEND_ONLY_ROUTE,
  )
  if (requiresFull) {
    return result('full', [`Storybook relevance is not excluded for ${requiresFull.status} ${requiresFull.path}.`])
  }

  return result('skip', ['Only the verified backend-only worker route was modified; skip the whole Storybook job.'])
}
