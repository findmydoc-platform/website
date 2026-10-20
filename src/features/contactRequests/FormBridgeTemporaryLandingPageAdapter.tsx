import { TemporaryLandingPage, type TemporaryLandingPageProps } from '@/components/templates/TemporaryLandingPage'
import { getTemporaryLandingPageContent } from '@/features/temporaryLandingMode'
import { projectHoldingFooterLinks } from '@/features/temporaryLandingMode/navigation'
import { getServerSideURL } from '@/utilities/getURL'

import { FormBridgeContactRequestFormAdapter } from './FormBridgeContactRequestFormAdapter.client'

type FormBridgeTemporaryLandingPageAdapterProps = Omit<TemporaryLandingPageProps, 'contactForm' | 'content'>

export function FormBridgeTemporaryLandingPageAdapter(props: FormBridgeTemporaryLandingPageAdapterProps) {
  const content = getTemporaryLandingPageContent(props.locale)
  const holdingContent = {
    ...content,
    footerLinks: projectHoldingFooterLinks(content.footerLinks, getServerSideURL()),
  }

  return (
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
  )
}
