'use client'

import { useRouter } from 'next/navigation'
import React, { useCallback, useState } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form'
import { Button } from '@/components/atoms/button'

import { getClientSideURL } from '@/utilities/getURL'
import { cn } from '@/utilities/ui'
import { Container } from '@/components/molecules/Container'

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
}

type FormValues = Record<string, unknown>

type FormFieldRenderProps = {
  form: FormConfig
  control: Control<FormValues>
  errors: FieldErrors<FormValues>
  register: UseFormRegister<FormValues>
} & Record<string, unknown>

export const Form: React.FC<FormProps> = (props) => {
  const {
    enableIntro,
    form: formFromProps,
    form: { id: formID, confirmationType, redirect, submitButtonLabel } = {},
    introContent,
    confirmationMessage,
    fields: fieldsComponents,
  } = props

  const formMethods = useForm<FormValues>({ defaultValues: {} })
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = formMethods

  const [isLoading, setIsLoading] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState<boolean>()
  const [error, setError] = useState<{ message: string; status?: string } | undefined>()
  const router = useRouter()

  const background = props.background ?? 'primary'
  const buttonVariant =
    background === 'secondary' || background === 'accent' || background === 'accent-2' ? 'secondary' : 'primary'

  const onSubmit = useCallback(
    (data: FormValues) => {
      let loadingTimerID: ReturnType<typeof setTimeout>
      const submitForm = async () => {
        setError(undefined)

        const dataToSend = Object.entries(data).map(([name, value]) => ({
          field: name,
          value,
        }))

        loadingTimerID = setTimeout(() => {
          setIsLoading(true)
        }, 1000)

        try {
          const req = await fetch(`${getClientSideURL()}/api/form-submissions`, {
            body: JSON.stringify({
              form: formID,
              submissionData: dataToSend,
            }),
            headers: {
              'Content-Type': 'application/json',
            },
            method: 'POST',
          })

          const res = await req.json()

          clearTimeout(loadingTimerID)

          if (req.status >= 400) {
            setIsLoading(false)
            setError({
              message: res.errors?.[0]?.message || 'Internal Server Error',
              status: res.status,
            })
            return
          }

          setIsLoading(false)
          setHasSubmitted(true)

          if (confirmationType === 'redirect' && redirect?.url) {
            router.push(redirect.url)
          }
        } catch (err) {
          console.warn(err)
          setIsLoading(false)
          setError({ message: 'Something went wrong.' })
        }
      }

      void submitForm()
    },
    [router, formID, redirect, confirmationType],
  )

  return (
    <Container className="lg:max-w-3xl">
      {enableIntro && introContent && !hasSubmitted && <div className="mb-8 lg:mb-12">{introContent}</div>}
      <div className="rounded-xl p-4 lg:p-6">
        <FormProvider {...formMethods}>
          {!isLoading && hasSubmitted && confirmationType === 'message' && <div>{confirmationMessage}</div>}
          {isLoading && !hasSubmitted && <p>Loading, please wait...</p>}
          {error && <div>{`${error.status || '500'}: ${error.message || ''}`}</div>}
          {!hasSubmitted && (
            <form id={formID} onSubmit={handleSubmit(onSubmit)}>
              <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                {formFromProps?.fields?.map((field, index) => {
                  const blockType = (field as { blockType?: string }).blockType
                  const Field = blockType
                    ? (fieldsComponents?.[blockType] as unknown as
                        | React.ComponentType<FormFieldRenderProps>
                        | undefined)
                    : undefined
                  if (Field) {
                    return (
                      <div key={index} className="w-full">
                        <Field
                          form={formFromProps}
                          {...field}
                          {...formMethods}
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

              <Button form={formID} type="submit" variant={buttonVariant} className={cn('w-full')}>
                {submitButtonLabel}
              </Button>
            </form>
          )}
        </FormProvider>
      </div>
    </Container>
  )
}
