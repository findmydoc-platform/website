'use client'

import { useFormFields, useOperation } from '@payloadcms/ui'
import type { GenericErrorProps } from 'payload'

import { ConditionalRequirementFieldError } from '@/app/(payload)/components/ConditionalRequirementFieldError'
import { reviewCreationRequirements } from '@/collections/reviews/creationRequirements'

export function ReviewCreationRequirementError(props: GenericErrorProps) {
  const value = useFormFields(([fields]) => fields.patient?.value)
  const operation = useOperation()
  const requirement = reviewCreationRequirements.patient

  return (
    <ConditionalRequirementFieldError
      {...props}
      conditionalMessage={requirement.message}
      isMissing={operation === 'create' && !requirement.valueIsPresent(value)}
    />
  )
}
