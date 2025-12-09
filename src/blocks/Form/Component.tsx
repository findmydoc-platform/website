'use client'

import type { Form as FormType } from '@payloadcms/plugin-form-builder/types'
import React from 'react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { fields } from './fields'
import { Form } from '@/components/organisms/Form'

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

  return (
    <Form
      id={id}
      background={background}
      enableIntro={enableIntro}
      form={form}
      introContent={introContent}
      fields={fields}
    />
  )
}
