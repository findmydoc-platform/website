'use client'

import type { RowLabelProps } from '@payloadcms/ui'
import { useRowLabel } from '@payloadcms/ui'

type CookieConsentCategoryRow = {
  key?: string
  label?: string
}

export const RowLabel: React.FC<RowLabelProps> = () => {
  const data = useRowLabel<CookieConsentCategoryRow>()
  const rowNumber = data?.rowNumber !== undefined ? data.rowNumber + 1 : null
  const label = data?.data?.label?.trim()
  const key = data?.data?.key?.trim()
  const prefix = rowNumber !== null ? `Category ${rowNumber}` : 'Category'

  if (label) {
    return <div>{`${prefix}: ${label}`}</div>
  }

  if (key) {
    return <div>{`${prefix}: ${key}`}</div>
  }

  return <div>{prefix}</div>
}
