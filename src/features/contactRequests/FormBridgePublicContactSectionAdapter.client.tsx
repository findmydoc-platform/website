'use client'

import {
  PublicContactSection,
  type ContactRequestSubmitter,
  type PublicContactSectionProps,
} from '@/components/organisms/Contact'

import { submitFormBridgeContactRequest } from './formBridgeBrowserGateway.client'

const onSubmitContact: ContactRequestSubmitter = (targetSlug, payload, genericErrorMessage) =>
  submitFormBridgeContactRequest(targetSlug, payload, genericErrorMessage)

export function FormBridgePublicContactSectionAdapter(props: Omit<PublicContactSectionProps, 'onSubmitContact'>) {
  return <PublicContactSection {...props} onSubmitContact={onSubmitContact} />
}
