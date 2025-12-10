'use client'

import type { FormFieldBlock, Form as FormType } from '@payloadcms/plugin-form-builder/types'

import { useRouter } from 'next/navigation'
import React, { useCallback, useState } from 'react'
import { useForm, FormProvider, UseFormReturn } from 'react-hook-form'
import RichText from '@/components/organisms/RichText'
import { Button } from '@/components/atoms/button'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { fields } from './fields'
import { getClientSideURL } from '@/utilities/getURL'
import { cn } from '@/utilities/ui'
import { Container } from '@/components/molecules/Container'

export type FormBlockType = {
  blockName?: string
  blockType?: 'formBlock'
  enableIntro: boolean
  form: FormType
  introContent?: SerializedEditorState
}

export const FormBlock: React.FC<
  {
    id?: string
    background?: 'primary' | 'secondary' | 'accent' | 'accent-2'
  } & FormBlockType
> = (props) => {
  const {
    enableIntro,
    form: formFromProps,
    form: { id: formID, confirmationMessage, confirmationType, redirect, submitButtonLabel } = {},
    introContent,
  } = props

  const formMethods = useForm<FormFieldBlock[]>({
    defaultValues: formFromProps.fields as unknown as FormFieldBlock[],
  })
  const { handleSubmit } = formMethods

  const [isLoading, setIsLoading] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState<boolean>()
  const [error, setError] = useState<{ message: string; status?: string } | undefined>()
  const router = useRouter()

  const background = props.background ?? 'primary'
  const buttonVariant =
    background === 'secondary' || background === 'accent' || background === 'accent-2' ? 'secondary' : 'primary'

  const onSubmit = useCallback(
    (data: FormFieldBlock[]) => {
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
      {enableIntro && introContent && !hasSubmitted && (
        <RichText className="mb-8 lg:mb-12" data={introContent} enableGutter={false} />
      )}
      <div className="rounded-xl p-4 lg:p-6">
        <FormProvider {...formMethods}>
          {!isLoading && hasSubmitted && confirmationType === 'message' && (
            <RichText data={confirmationMessage} enableGutter={false} />
          )}
          {isLoading && !hasSubmitted && <p>Loading, please wait...</p>}
          {error && <div>{`${error.status || '500'}: ${error.message || ''}`}</div>}
          {!hasSubmitted && (
            <form id={formID} onSubmit={handleSubmit(onSubmit)}>
              <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                {formFromProps?.fields?.map((field, index) => {
                  type FieldComponentProps = FormFieldBlock & UseFormReturn<FormFieldBlock[]> & { form: FormType }
                  const FieldComponent = fields?.[field.blockType as keyof typeof fields] as
                    | React.ComponentType<FieldComponentProps>
                    | undefined
                  if (FieldComponent) {
                    return (
                      <div key={index} className="w-full">
                        <FieldComponent form={formFromProps} {...field} {...formMethods} />
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
