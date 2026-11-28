import { TemporaryLandingPage, type TemporaryLandingPageProps } from '@/components/templates/TemporaryLandingPage'
import { CookieConsentLauncherSlot } from '@/features/cookieConsent/CookieConsentLauncherSlot.client'
import { getTemporaryLandingPageContent } from '@/features/temporaryLandingMode'
import { projectHoldingFooterLinks, type HoldingLegalLinks } from '@/features/temporaryLandingMode/navigation'
import { HoldingDocumentLanguage } from '@/features/uiCopy/DocumentLanguage.client'
import { getServerSideURL } from '@/utilities/getURL'

import { FormBridgeContactRequestFormAdapter } from './FormBridgeContactRequestFormAdapter.client'

type FormBridgeTemporaryLandingPageAdapterProps = Omit<TemporaryLandingPageProps, 'contactForm' | 'content'> & {
  legalLinks: HoldingLegalLinks
}

export function FormBridgeTemporaryLandingPageAdapter({
  legalLinks,
  ...props
}: FormBridgeTemporaryLandingPageAdapterProps) {
  const content = getTemporaryLandingPageContent(props.locale)
  const holdingContent = {
    ...content,
    footerLinks: projectHoldingFooterLinks(content.footerLinks, getServerSideURL(), legalLinks),
  }

  return (
    <>
      <HoldingDocumentLanguage locale={props.locale} />
      <TemporaryLandingPage
        {...props}
        content={holdingContent}
        contactForm={
          <FormBridgeContactRequestFormAdapter
            contactFormSlug={content.contactFormSlug}
            contactMode={content.contactMode ?? 'full'}
            labels={content.contactFormLabels}
            primaryCtaLabel={content.primaryCtaLabel}
          />
        }
      />
      <CookieConsentLauncherSlot />
    </>
  )
}
