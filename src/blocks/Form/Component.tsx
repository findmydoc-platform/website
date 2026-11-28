'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'

import { Form, type FormConfig, type FormValues } from '@/components/organisms/Form'
import type { FormCopy } from '@/components/organisms/Form/copy'
import { submitFormData } from '@/utilities/submitForm'

import { fields } from './fields'

type Props = {
  id?: string
  background?: 'primary' | 'secondary' | 'accent' | 'accent-2'
  enableIntro?: boolean | null
  form: FormConfig
  introContent?: ReactNode
  confirmationMessage?: ReactNode
  copy: FormCopy
  locale?: 'de' | 'en'
}

export function FormBlock({
  enableIntro,
  form,
  introContent,
  confirmationMessage,
  background,
  copy,
  locale,
  id,
}: Props) {
  const router = useRouter()
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [error, setError] = useState<string>()

  async function handleSubmit(values: FormValues) {
    setError(undefined)

    try {
      await submitFormData({ formId: form.id, values })
    } catch {
      setError(copy.failure)
      return
    }

    setHasSubmitted(true)

    if (form.confirmationType === 'redirect' && form.redirect?.url) {
      router.push(form.redirect.url)
    }
  }

  return (
    <Form
      id={id}
      background={background}
      enableIntro={Boolean(enableIntro)}
      form={form}
      introContent={introContent}
      confirmationMessage={confirmationMessage}
      fields={fields}
      hasSubmitted={hasSubmitted}
      error={error}
      copy={copy}
      locale={locale}
      onSubmit={handleSubmit}
    />
  )
}
