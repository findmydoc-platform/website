'use client'

import type { RowLabelProps } from '@payloadcms/ui'
import { useRowLabel } from '@payloadcms/ui'

import {
  COOKIE_CONSENT_CATEGORY_REGISTRY,
  COOKIE_CONSENT_TOOL_REGISTRY,
  type CookieConsentCategoryKey,
  type CookieConsentToolKey,
} from '@/features/cookieConsent'

type CookieConsentCategoryRow = {
  key?: CookieConsentCategoryKey
  label?: string
  tools?: CookieConsentToolKey[]
}

export const RowLabel: React.FC<RowLabelProps> = () => {
  const data = useRowLabel<CookieConsentCategoryRow>()
  const rowNumber = data?.rowNumber !== undefined ? data.rowNumber + 1 : null
  const key = data?.data?.key
  const label = data?.data?.label?.trim() || (key ? COOKIE_CONSENT_CATEGORY_REGISTRY[key]?.label : undefined)
  const tools = data?.data?.tools?.flatMap((tool) => {
    const toolLabel = COOKIE_CONSENT_TOOL_REGISTRY[tool]?.label
    return toolLabel ? [toolLabel] : []
  })
  const prefix = rowNumber !== null ? `Category ${rowNumber}` : 'Category'
  const suffix = tools && tools.length > 0 ? ` (${tools.join(', ')})` : ''

  if (label) {
    return <div>{`${prefix}: ${label}${suffix}`}</div>
  }

  if (key) {
    return <div>{`${prefix}: ${key}${suffix}`}</div>
  }

  return <div>{`${prefix}${suffix}`}</div>
}
