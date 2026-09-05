import { TemporaryLandingPage, type TemporaryLandingPageProps } from '@/components/templates/TemporaryLandingPage'
import { getTemporaryLandingPageContent } from '@/features/temporaryLandingMode'

import { FormBridgeContactRequestFormAdapter } from './FormBridgeContactRequestFormAdapter.client'

type FormBridgeTemporaryLandingPageAdapterProps = Omit<TemporaryLandingPageProps, 'contactForm' | 'content'>

export function FormBridgeTemporaryLandingPageAdapter(props: FormBridgeTemporaryLandingPageAdapterProps) {
  const content = getTemporaryLandingPageContent(props.locale)

  return (
    <TemporaryLandingPage
      {...props}
      content={content}
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
