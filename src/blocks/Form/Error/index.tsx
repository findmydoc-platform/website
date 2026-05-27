import * as React from 'react'

import { FieldError } from '@/components/atoms/field'

export function getFormFieldErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined

  const message = 'message' in error ? error.message : undefined
  return typeof message === 'string' && message ? message : undefined
}

export const Error: React.FC<{ error?: unknown; id?: string; message?: string }> = ({ error, id, message }) => {
  const errorMessage = message ?? getFormFieldErrorMessage(error) ?? 'This field is required.'

  return <FieldError id={id}>{errorMessage}</FieldError>
}
