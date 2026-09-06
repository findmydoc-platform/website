'use client'

import { ContactRequestForm } from '@/components/organisms/Contact/ContactRequestForm.client'
import type { ContactRequestFormLabels, ContactRequestSubmitter } from '@/components/organisms/Contact'

import { submitFormBridgeContactRequest } from './formBridgeBrowserGateway.client'

export type FormBridgeContactRequestFormAdapterProps = {
  contactFormSlug?: string
  contactMode: 'compact' | 'full'
  labels?: ContactRequestFormLabels
  primaryCtaLabel: string
}

const onSubmitContact: ContactRequestSubmitter = (targetSlug, payload, genericErrorMessage) =>
  submitFormBridgeContactRequest(targetSlug, payload, genericErrorMessage)

export function FormBridgeContactRequestFormAdapter(props: FormBridgeContactRequestFormAdapterProps) {
  return <ContactRequestForm {...props} onSubmitContact={onSubmitContact} />
}
