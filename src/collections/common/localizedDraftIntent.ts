import type { CollectionBeforeOperationHook, PayloadRequest } from 'payload'

export function localizedDraftIntent(collection: 'pages' | 'posts') {
  const contextKey = `${collection}DraftSave`

  const beforeOperation: CollectionBeforeOperationHook = ({ args, operation, req }) => {
    if (operation === 'update') {
      const status = args.data && '_status' in args.data ? args.data._status : undefined
      req.context[contextKey] = args.draft === true && status !== 'published' && args.unpublishAllLocales !== true
    }
    return args
  }

  const isDraftSave = (context: PayloadRequest['context']): boolean => context[contextKey] === true

  return { beforeOperation, isDraftSave }
}
