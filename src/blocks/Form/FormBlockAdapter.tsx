import RichText from '@/blocks/_shared/RichText'
import { cmsFormCopy } from '@/features/uiCopy/cmsForm'
import type { FormBlock as CmsFormBlock } from '@/payload-types'
import { DEFAULT_CONTENT_LOCALE, type ContentLocaleContext } from '@/utilities/contentLocalization'

import { FormBlock } from './Component'

type Props = Omit<CmsFormBlock, 'blockType'> & {
  background?: 'primary' | 'secondary' | 'accent' | 'accent-2'
  contentLocale?: ContentLocaleContext
}

function formRedirect(url?: string) {
  if (!url) return undefined

  try {
    const target = new URL(url, 'https://findmydoc.invalid')
    return ['http:', 'https:'].includes(target.protocol) ? { url } : undefined
  } catch {
    return undefined
  }
}

export async function FormBlockAdapter({ enableIntro, form, introContent, background, contentLocale, id }: Props) {
  if (!form || typeof form !== 'object') return null

  const locale = contentLocale?.locale ?? DEFAULT_CONTENT_LOCALE
  const copy = await cmsFormCopy(locale)

  return (
    <FormBlock
      key={`${locale}:${form.id}`}
      id={id ?? undefined}
      background={background}
      enableIntro={enableIntro}
      form={{
        id: String(form.id),
        fields: form.fields?.map((field) =>
          field.blockType === 'message'
            ? {
                blockType: field.blockType,
                id: field.id,
                content: field.message && <RichText contentLocale={contentLocale} data={field.message} />,
              }
            : field,
        ),
        confirmationType: form.confirmationType ?? undefined,
        redirect: formRedirect(form.redirect?.url),
        submitButtonLabel: form.submitButtonLabel?.trim() || undefined,
      }}
      introContent={introContent && <RichText contentLocale={contentLocale} data={introContent} enableGutter={false} />}
      confirmationMessage={
        form.confirmationMessage && (
          <RichText contentLocale={contentLocale} data={form.confirmationMessage} enableGutter={false} />
        )
      }
      copy={copy}
      locale={locale}
    />
  )
}
