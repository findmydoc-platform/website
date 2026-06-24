import type React from 'react'

import type { AboutImage } from './types'
import { atomMotion, boundaryItems, signalItems } from './aboutPageViewModel'

export const resolveImageObjectPositionStyle = (image: AboutImage): React.CSSProperties | undefined =>
  image.objectPosition ? { objectPosition: image.objectPosition } : undefined

export const getSignalItem = (index: number) => signalItems[index] ?? signalItems[0]!

export const getBoundaryItem = (index: number) => boundaryItems[index] ?? boundaryItems[0]!

export const getAtomMotion = (index: number) => atomMotion[index] ?? atomMotion[0]!
