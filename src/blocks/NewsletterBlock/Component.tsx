import type { NewsletterBlock as NewsletterBlockProps } from '@/payload-types'
import React from 'react'
import { cn } from '@/utilities/ui'
import { Container } from '@/components/Container'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { FormBlock } from '../Form/Component'
import type { Form as PluginForm } from '@payloadcms/plugin-form-builder/types'

type Props = {
  className?: string
} & NewsletterBlockProps

export const NewsletterBlock: React.FC<Props> = ({ background, textcolor, text, form, fullWidth, className }) => {
  const bg = background ?? 'primary'
  const fg = textcolor ?? 'primary'

  // Hintergrundfarben (deine Tokens)
  const backgroundClasses = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    accent: 'bg-accent',
    'accent-2': 'bg-accent-2',
  }[bg]

  // Textfarben (bewusst direkt steuerbar, wie von dir gewünscht)
  const textColorClasses = {
    primary: 'text-primary',
    secondary: 'text-secondary', // Fixed typo
    accent: 'text-accent',
    'accent-2': 'text-accent-2',
  }[fg]

  const Inner: React.FC = () => (
    <div className={cn('overflow-hidden rounded-[3rem] px-6 py-12', backgroundClasses, textColorClasses)}>
      <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="space-y-4 pl-12 md:w-1/2">
          <RichText data={text} className="prose-lg max-w-none lg:prose-xl" />
        </div>
        <div className="md:w-1/2">
          {typeof form === 'object' && form ? (
            <FormBlock form={form as unknown as PluginForm} background={bg} enableIntro={false} />
          ) : (
            <p className="text-sm opacity-80">⚠️ Kein Formular ausgewählt.</p>
          )}
        </div>
      </div>
    </div>
  )

  if (fullWidth) {
    return (
      <section className={cn('full-bleed my-12', className)}>
        <div className="container-site">
          <Inner />
        </div>
      </section>
    )
  }

  return (
    <section className={cn('my-12', className)}>
      <Container>
  <Inner />
      </Container>
    </section>
  )
}
