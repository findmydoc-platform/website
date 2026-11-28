'use client'

import React, { type FormEvent } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form'
import { Button } from '@/components/atoms/button'

import { Container } from '@/components/molecules/Container'
import {
  collectNativeValidationErrors,
  focusFirstInvalidControl,
  type NativeValidationMessageOverridesByField,
} from '@/components/molecules/PublicFormValidation'

import { defaultFormCopy, type FormCopy } from './copy'

export interface FormConfig {
  id: string
  confirmationType?: 'message' | 'redirect'
  redirect?: {
    url: string
  }
  submitButtonLabel?: string
  fields?: Array<{
    blockType: string
    [key: string]: unknown
  }>
}

export type FormProps = {
  id?: string
  background?: 'primary' | 'secondary' | 'accent' | 'accent-2'
  enableIntro?: boolean
  form: FormConfig
  introContent?: React.ReactNode
  confirmationMessage?: React.ReactNode
  fields?: Record<string, React.ComponentType<never>>
  isLoading?: boolean
  hasSubmitted?: boolean
  error?: string
  copy?: FormCopy
  locale?: 'de' | 'en'
  onSubmit?: (data: FormValues) => void | Promise<void>
}

export type FormValues = Record<string, unknown>

type FormFieldRenderProps = {
  form: FormConfig
  copy: FormCopy
  control: Control<FormValues>
  errors: FieldErrors<FormValues>
  register: UseFormRegister<FormValues>
} & Record<string, unknown>

export const Form: React.FC<FormProps> = (props) => {
  const {
    enableIntro,
    form: formFromProps,
    form: { submitButtonLabel } = {},
    introContent,
    confirmationMessage,
    fields: fieldsComponents,
    copy = defaultFormCopy,
    locale,
    isLoading = false,
    hasSubmitted = false,
    error,
    onSubmit,
  } = props

  const formMethods = useForm<FormValues>({ defaultValues: {} })
  const {
    clearErrors,
    control,
    getFieldState,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = formMethods

  const background = props.background ?? 'primary'
  const buttonVariant =
    background === 'secondary' || background === 'accent' || background === 'accent-2' ? 'secondary' : 'primary'

  const pending = isLoading || isSubmitting

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return

    const validationCopy: NativeValidationMessageOverridesByField = Object.fromEntries(
      (formFromProps.fields ?? []).flatMap(({ name }) =>
        typeof name === 'string'
          ? [[name, { valueMissing: copy.required, typeMismatch: copy.invalidEmail, badInput: copy.invalidValue }]]
          : [],
      ),
    )
    const formElement = event.currentTarget
    const validation = collectNativeValidationErrors(formElement, validationCopy)
    if (validation.firstInvalidField) {
      for (const [name, message] of Object.entries(validation.errors)) setError(name, { type: 'native', message })
      focusFirstInvalidControl(formElement, validation.firstInvalidField)
      return
    }

    void handleSubmit(async (values) => {
      await onSubmit?.(values)
    })(event)
  }

  return (
    <Container className="lg:max-w-3xl">
      {enableIntro && introContent && !hasSubmitted && <div className="mb-8 lg:mb-12">{introContent}</div>}
      <div className="rounded-xl p-4 lg:p-6" lang={locale}>
        <FormProvider {...formMethods}>
          {hasSubmitted && <div role="status">{confirmationMessage ?? copy.success}</div>}
          {pending && !hasSubmitted && <p role="status">{copy.pending}</p>}
          {error && <div role="alert">{error}</div>}
          {!hasSubmitted && (
            <form
              id={props.id}
              onSubmit={handleFormSubmit}
              onChange={(event) => {
                const field = event.target
                if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
                  if (getFieldState(field.name).error?.type === 'native') clearErrors(field.name)
                }
              }}
              aria-busy={pending || undefined}
              noValidate
            >
              <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                {formFromProps?.fields?.map((field, index) => {
                  const blockType = (field as { blockType?: string }).blockType
                  const Field = blockType
                    ? (fieldsComponents?.[blockType] as unknown as
                        React.ComponentType<FormFieldRenderProps> | undefined)
                    : undefined
                  if (Field) {
                    return (
                      <div key={typeof field.id === 'string' ? field.id : index} className="w-full">
                        <Field
                          form={formFromProps}
                          {...field}
                          {...formMethods}
                          copy={copy}
                          locale={locale}
                          control={control}
                          errors={errors}
                          register={register}
                        />
                      </div>
                    )
                  }
                  return null
                })}
              </div>

              <Button type="submit" variant={buttonVariant} className="w-full" disabled={pending}>
                {submitButtonLabel || copy.submit}
              </Button>
            </form>
          )}
        </FormProvider>
      </div>
    </Container>
  )
}
