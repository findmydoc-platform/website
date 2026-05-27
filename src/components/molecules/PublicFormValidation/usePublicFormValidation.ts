'use client'

import * as React from 'react'

import {
  collectNativeValidationErrors,
  focusFirstInvalidControl,
  type NativeValidationMessageOverridesByField,
} from './logic'

export type PublicFormValidationOptions = {
  messages?: NativeValidationMessageOverridesByField
}

export type PublicFormValidation = {
  clearAllFieldErrors: () => void
  clearFieldError: (fieldName: string) => void
  fieldErrors: Record<string, string>
  getFieldError: (fieldName: string) => string | undefined
  getFieldErrorId: (fieldName: string) => string
  getFieldProps: (
    fieldName: string,
    describedBy?: string,
  ) => {
    'aria-describedby': string | undefined
    'aria-invalid': true | undefined
  }
  handleFieldChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  handleInvalid: (event: React.InvalidEvent<HTMLFormElement>) => void
  setCustomFieldError: (fieldName: string, message: string) => void
  setCustomFieldErrors: (nextErrors: Record<string, string>) => void
  validateForm: (form: HTMLFormElement) => boolean
}

export function usePublicFormValidation(options: PublicFormValidationOptions = {}): PublicFormValidation {
  const { messages } = options
  const errorIdPrefix = React.useId()
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})

  const clearAllFieldErrors = React.useCallback(() => {
    setFieldErrors({})
  }, [])

  const clearFieldError = React.useCallback((fieldName: string) => {
    setFieldErrors((current) => {
      if (!current[fieldName]) return current

      const { [fieldName]: _removed, ...remaining } = current
      return remaining
    })
  }, [])

  const handleFieldChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      if (!event.currentTarget.name) return
      clearFieldError(event.currentTarget.name)
    },
    [clearFieldError],
  )

  const handleInvalid = React.useCallback((event: React.InvalidEvent<HTMLFormElement>) => {
    event.preventDefault()
  }, [])

  const validateForm = React.useCallback(
    (form: HTMLFormElement) => {
      const result = collectNativeValidationErrors(form, messages)

      setFieldErrors(result.errors)

      if (result.firstInvalidField) {
        focusFirstInvalidControl(form, result.firstInvalidField)
        return false
      }

      return true
    },
    [messages],
  )

  const setCustomFieldError = React.useCallback((fieldName: string, message: string) => {
    setFieldErrors((current) => ({
      ...current,
      [fieldName]: message,
    }))
  }, [])

  const setCustomFieldErrors = React.useCallback((nextErrors: Record<string, string>) => {
    setFieldErrors(nextErrors)
  }, [])

  const getFieldError = React.useCallback((fieldName: string) => fieldErrors[fieldName], [fieldErrors])

  const getFieldErrorId = React.useCallback(
    (fieldName: string) => `${errorIdPrefix}-${fieldName}-field-error`,
    [errorIdPrefix],
  )

  const getFieldProps = React.useCallback(
    (fieldName: string, describedBy?: string) => {
      const error = fieldErrors[fieldName]
      const errorId = error ? getFieldErrorId(fieldName) : undefined
      const ariaDescribedBy = [describedBy, errorId].filter(Boolean).join(' ') || undefined

      return {
        'aria-describedby': ariaDescribedBy,
        'aria-invalid': error ? (true as const) : undefined,
      }
    },
    [fieldErrors, getFieldErrorId],
  )

  return {
    clearAllFieldErrors,
    clearFieldError,
    fieldErrors,
    getFieldError,
    getFieldErrorId,
    getFieldProps,
    handleFieldChange,
    handleInvalid,
    setCustomFieldError,
    setCustomFieldErrors,
    validateForm,
  }
}
