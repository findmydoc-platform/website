'use client'

import type { Form as FormType } from '@payloadcms/plugin-form-builder/types'
import { useRouter } from 'next/navigation'
import React from 'react'
import { useCallback, useState } from 'react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { fields } from './fields'
import { Form, type FormConfig, type FormSubmitError, type FormValues } from '@/components/organisms/Form'
import RichText from '@/blocks/_shared/RichText'
import { FormSubmissionError, submitFormData } from '@/utilities/submitForm'

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
  const { enableIntro, form, introContent, background, id } = props
  const router = useRouter()

  const introContentNode = introContent ? <RichText data={introContent} enableGutter={false} /> : undefined
  const confirmationMessageNode = form.confirmationMessage ? (
    <RichText data={form.confirmationMessage} enableGutter={false} />
  ) : undefined
  const [isLoading, setIsLoading] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [error, setError] = useState<FormSubmitError | undefined>()

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      const loadingTimer = setTimeout(() => {
        setIsLoading(true)
      }, 1000)

      setError(undefined)

      try {
        await submitFormData({
          formId: form.id,
          values,
        })

        clearTimeout(loadingTimer)
        setIsLoading(false)
        setHasSubmitted(true)

        if (form.confirmationType === 'redirect' && form.redirect?.url) {
          router.push(form.redirect.url)
        }
      } catch (submissionError) {
        clearTimeout(loadingTimer)
        setIsLoading(false)

        if (submissionError instanceof FormSubmissionError) {
          setError({
            message: submissionError.message,
            status: String(submissionError.status),
          })
          return
        }

        console.warn(submissionError)
        setError({ message: 'Something went wrong.' })
      }
    },
    [form.confirmationType, form.id, form.redirect?.url, router],
  )

  return (
    <Form
      id={id}
      background={background}
      enableIntro={enableIntro}
      form={form as unknown as FormConfig}
      introContent={introContentNode}
      confirmationMessage={confirmationMessageNode}
      fields={fields}
      isLoading={isLoading}
      hasSubmitted={hasSubmitted}
      error={error}
      onSubmit={handleSubmit}
    />
  )
}
