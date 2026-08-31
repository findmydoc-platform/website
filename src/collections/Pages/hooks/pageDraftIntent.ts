import type { CollectionBeforeOperationHook, PayloadRequest } from 'payload'

const PAGE_DRAFT_SAVE_CONTEXT_KEY = 'pageDraftSave'

export const capturePageDraftSaveIntent: CollectionBeforeOperationHook<'pages'> = ({ args, operation, req }) => {
  if (operation !== 'update') {
    return args
  }

  req.context = req.context ?? {}
  req.context[PAGE_DRAFT_SAVE_CONTEXT_KEY] = args.draft === true && args.unpublishAllLocales !== true

  return args
}

export const isPageDraftSaveIntent = (context: PayloadRequest['context']): boolean =>
  context[PAGE_DRAFT_SAVE_CONTEXT_KEY] === true
