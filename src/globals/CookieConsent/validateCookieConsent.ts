import {
  COOKIE_CONSENT_CATEGORY_ORDER,
  toCookieConsentCategorySettings,
  type CookieConsentCategoryKey,
  normalizeCookieConsentCategories,
} from '@/features/cookieConsent/categories'
import {
  COOKIE_CONSENT_TOOL_REGISTRY,
  type CookieConsentToolKey,
  isCookieConsentToolKey,
} from '@/features/cookieConsent/toolConsent'

type CookieConsentGlobalInput = {
  optionalCategorySettings?: unknown
  optionalCategories?: unknown
}

export function validateCookieConsentToolAssignments(data: CookieConsentGlobalInput | null | undefined): void {
  if (!data) {
    return
  }

  const hasNewCategorySettings = Object.prototype.hasOwnProperty.call(data, 'optionalCategorySettings')
  const hasLegacyCategories = Object.prototype.hasOwnProperty.call(data, 'optionalCategories')

  if (!hasNewCategorySettings && !hasLegacyCategories) {
    return
  }

  const source = hasNewCategorySettings ? data.optionalCategorySettings : data.optionalCategories
  const categories = normalizeCookieConsentCategories(source)
  data.optionalCategorySettings = toCookieConsentCategorySettings(categories)
  delete data.optionalCategories

  const assignedTools = new Map<CookieConsentToolKey, CookieConsentCategoryKey>()

  for (const categoryKey of COOKIE_CONSENT_CATEGORY_ORDER) {
    const category = categories.find((entry) => entry.key === categoryKey)

    if (!category) {
      continue
    }

    for (const tool of category.tools) {
      if (!isCookieConsentToolKey(tool)) {
        continue
      }

      const existingCategory = assignedTools.get(tool)
      if (existingCategory && existingCategory !== category.key) {
        throw new Error(
          `Tool "${COOKIE_CONSENT_TOOL_REGISTRY[tool].label}" can only be assigned to one consent category.`,
        )
      }

      assignedTools.set(tool, category.key)
    }
  }
}
