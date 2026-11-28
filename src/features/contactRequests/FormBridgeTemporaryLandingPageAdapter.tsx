import { TemporaryLandingPage, type TemporaryLandingPageProps } from '@/components/templates/TemporaryLandingPage'
import { getTemporaryLandingPageContent } from '@/features/temporaryLandingMode'
import { projectHoldingFooterLinks } from '@/features/temporaryLandingMode/navigation'
import { publicContactCopy } from '@/features/uiCopy/publicContact'
import { HoldingDocumentLanguage } from '@/features/uiCopy/DocumentLanguage.client'
import { getServerSideURL } from '@/utilities/getURL'

import { FormBridgeContactRequestFormAdapter } from './FormBridgeContactRequestFormAdapter.client'

type FormBridgeTemporaryLandingPageAdapterProps = Omit<TemporaryLandingPageProps, 'contactForm' | 'content'>

export async function FormBridgeTemporaryLandingPageAdapter(props: FormBridgeTemporaryLandingPageAdapterProps) {
  const content = getTemporaryLandingPageContent(props.locale)
  const copy = props.locale === 'tr' ? undefined : await publicContactCopy(props.locale)
  const holdingContent = {
    ...content,
    contactDescription: copy?.contactHints.full ?? content.contactDescription,
    contactEyebrow: copy?.contactEyebrow ?? content.contactEyebrow,
    contactConsentFull: copy?.contactConsent ?? content.contactConsentFull,
    footerLinks: projectHoldingFooterLinks(content.footerLinks, getServerSideURL()),
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
            labels={copy?.contactFormLabels ?? content.contactFormLabels}
            primaryCtaLabel={copy?.primaryCtaLabel ?? content.primaryCtaLabel}
          />
        }
      />
    </>
  )
}
