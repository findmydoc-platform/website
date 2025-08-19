import React from 'react'
import Image from 'next/image'
import type { Media } from '@/payload-types'
import { cn } from '@/utilities/ui'

type Color = 'primary' | 'secondary' | 'accent' | 'accent-2'
type ImageMode = 'normal' | 'background'
type NormalImagePosition = 'above' | 'below'
type BackgroundImagePosition = 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
type LinkType = 'arrow' | 'text'

type RelationshipValue = { slug?: string } | string

type BenefitCard = {
  title: string
  subtitle?: string
  backgroundColor: Color
  textColor?: Color
  imageMode?: ImageMode
  imagePositionNormal?: NormalImagePosition
  imagePositionBackground?: BackgroundImagePosition
  image?: Media | string | null
  showButton?: boolean
  linkType?: LinkType
  linkText?: string
  linkTarget?: { relationTo: 'pages' | 'posts'; value: RelationshipValue } | null
  arrowColor?: Color
  arrowBgColor?: Color
}

type Props = {
  className?: string
  cards: BenefitCard[]
}

const bgClassMap: Record<Color, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  accent: 'bg-accent',
  'accent-2': 'bg-accent-2',
}

const textForegroundMap: Record<Color, string> = {
  primary: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  accent: 'text-accent-foreground',
  'accent-2': 'text-accent-2-foreground',
}

const textDirectMap: Record<Color, string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  accent: 'text-accent',
  'accent-2': 'text-accent-2',
}

const posClassMap: Record<BackgroundImagePosition, string> = {
  center: 'inset-0 m-auto',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
}

function getImageUrl(img?: BenefitCard['image']): string | null {
  if (!img) return null
  if (typeof img === 'string') return img
  if (typeof img === 'object' && 'url' in img && img.url) return img.url as string
  return null
}

function buildHref(target?: BenefitCard['linkTarget']): string {
  if (!target || !target.value) return '#'
  const val = target.value as any
  const slug = typeof val === 'object' ? val.slug : undefined
  return slug ? `/${slug}` : '#'
}

export const BenefitsBlock: React.FC<Props> = ({ cards, className }) => {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-4 gap-6', className)}>
      {cards.map((card, idx) => {
        const imageUrl = getImageUrl(card.image)

        const showImageAbove = card.imageMode === 'normal' && card.imagePositionNormal === 'above'
        const showImageBelow = card.imageMode === 'normal' && card.imagePositionNormal === 'below'

        const textClasses = card.textColor ? textDirectMap[card.textColor] : textForegroundMap[card.backgroundColor]

        const linkHref = buildHref(card.linkTarget)

        return (
          <article
            key={idx}
            className={cn(
              'relative overflow-hidden p-8 rounded-3xl flex flex-col justify-between transition-all',
              'min-h-48',
              bgClassMap[card.backgroundColor],
              textClasses,
            )}
          >
            {card.imageMode === 'background' && imageUrl && (
              <div
                className={cn(
                  'absolute z-0 pointer-events-none select-none',
                  'w-1/2 h-1/2',
                  posClassMap[card.imagePositionBackground || 'bottom-right'],
                )}
                aria-hidden
              >
                <Image
                  src={imageUrl}
                  alt=""
                  fill
                  className={cn('object-contain opacity-80 rounded-none bg-transparent')}
                  sizes="50vw"
                  unoptimized
                  priority={false}
                />
              </div>
            )}

            <div className="relative z-10 flex flex-col gap-2">
              {showImageAbove && imageUrl && (
                <Image
                  src={imageUrl}
                  alt=""
                  width={112}
                  height={112}
                  className="w-28 h-28 object-contain mb-2 rounded-none bg-transparent"
                  unoptimized
                  priority={false}
                />
              )}

              <h3 className="text-xl font-semibold tracking-tight">{card.title}</h3>
              {card.subtitle && <p className="text-sm opacity-90">{card.subtitle}</p>}

              {showImageBelow && imageUrl && (
                <Image
                  src={imageUrl}
                  alt=""
                  width={112}
                  height={112}
                  className="w-28 h-28 object-contain mt-2 rounded-none bg-transparent"
                  unoptimized
                  priority={false}
                />
              )}
            </div>

            {card.showButton && card.linkTarget && (
              <div className="relative z-10 mt-6 self-start">
                <a
                  href={linkHref}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-full',
                    bgClassMap[card.arrowBgColor || card.backgroundColor],
                    textDirectMap[card.arrowColor || 'primary'],
                  )}
                >
                  {card.linkType === 'text' && card.linkText ? (
                    <>
                      <span>{card.linkText}</span>
                      <span aria-hidden>→</span>
                    </>
                  ) : (
                    <span aria-hidden>→</span>
                  )}
                </a>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
