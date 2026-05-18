import type { StaticImageData } from 'next/image'
import type { ElementType, Ref } from 'react'

export interface Props {
  alt?: string
  className?: string
  fill?: boolean // for NextImage only
  htmlElement?: ElementType | null
  imgClassName?: string
  onClick?: () => void
  onError?: () => void
  onLoad?: () => void
  loading?: 'lazy' | 'eager' // for NextImage only
  priority?: boolean // for NextImage only
  quality?: number // for NextImage only
  ref?: Ref<HTMLImageElement | HTMLVideoElement | null>
  src?: StaticImageData | string
  width?: number
  height?: number
  size?: string // for NextImage only
  videoClassName?: string
  type?: 'video' | 'image'
}
