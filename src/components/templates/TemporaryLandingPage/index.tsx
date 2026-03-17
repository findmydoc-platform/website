import { LanguageSwitcher } from '@/components/molecules/LanguageSwitcher'
import { HoldingPageConcept } from '@/components/templates/HoldingPageConcept'
import {
  getTemporaryLandingPageContent,
  type TemporaryLandingLanguageOption,
  type TemporaryLandingLocale,
} from '@/features/temporaryLandingMode'

type TemporaryLandingPageProps = {
  languageOptions: TemporaryLandingLanguageOption[]
  locale: TemporaryLandingLocale
}

export function TemporaryLandingPage({ languageOptions, locale }: TemporaryLandingPageProps) {
  const content = getTemporaryLandingPageContent(locale)

  return (
    <HoldingPageConcept
      {...content}
      heroOverlay={
        <LanguageSwitcher
          ariaLabel="Landing page language"
          className="pointer-events-auto"
          currentValue={locale}
          options={languageOptions}
        />
      }
    />
  )
}
