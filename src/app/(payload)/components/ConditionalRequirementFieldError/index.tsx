'use client'

import { FieldError } from '@payloadcms/ui'
import type { GenericErrorProps } from 'payload'

import './index.scss'

type ConditionalRequirementFieldErrorProps = GenericErrorProps & {
  conditionalMessage: string
  isMissing: boolean
}

export function ConditionalRequirementFieldError({
  conditionalMessage,
  isMissing,
  message,
  path,
  showError,
}: ConditionalRequirementFieldErrorProps) {
  if (isMissing) {
    return <p className="conditional-requirement-field-error">{conditionalMessage}</p>
  }

  return <FieldError message={message} path={path} showError={showError} />
}
