'use client'

import type { Form as FormType } from '@payloadcms/plugin-form-builder/types'
import React from 'react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { fields } from './fields'
import { Form, type FormConfig } from '@/components/organisms/Form'
import RichText from '@/blocks/_shared/RichText'

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

  const introContentNode = introContent ? <RichText data={introContent} enableGutter={false} /> : undefined
  const confirmationMessageNode = form.confirmationMessage ? (
    <RichText data={form.confirmationMessage} enableGutter={false} />
  ) : undefined

  return (
    <Form
      id={id}
      background={background}
      enableIntro={enableIntro}
      form={form as unknown as FormConfig}
      introContent={introContentNode}
      confirmationMessage={confirmationMessageNode}
      fields={fields}
    />
  )
}
