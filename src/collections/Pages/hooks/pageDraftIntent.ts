import { localizedDraftIntent } from '@/collections/common/localizedDraftIntent'

export const { beforeOperation: capturePageDraftSaveIntent, isDraftSave: isPageDraftSaveIntent } =
  localizedDraftIntent('pages')
