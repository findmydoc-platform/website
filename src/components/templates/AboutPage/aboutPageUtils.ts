import type React from 'react'

import type { AboutImage } from './types'
import { atomMotion } from './aboutPageViewModel'

export const resolveImageObjectPositionStyle = (image: AboutImage): React.CSSProperties | undefined =>
  image.objectPosition ? { objectPosition: image.objectPosition } : undefined

export const getAtomMotion = (index: number) => atomMotion[index] ?? atomMotion[0]!
