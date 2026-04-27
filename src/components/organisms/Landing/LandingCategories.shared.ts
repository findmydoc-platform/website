import type { ImageProps } from 'next/image'

export type LandingCategory = {
  label: string
  value: string
}

export type LandingCategoryItem = {
  id: string
  title: string
  subtitle?: string | null
  categories: string[]
  href?: string
  newTab?: boolean
  image: {
    src: ImageProps['src']
    alt: string
  }
}

export type LandingCategoriesProps = {
  title: string
  description: string
  categories: LandingCategory[]
  items: LandingCategoryItem[]
  featuredIds?: string[]
  defaultActiveFilter?: string
  moreCategoriesLink?: {
    href: string
    label?: string | null
    newTab?: boolean
  }
}

export const ALL_CATEGORY_VALUE = 'all'
const ALL_CATEGORY_LABEL = 'All'

// Slot layout definitions for the 4-card collage.
// Grid model:
// - Slot 0: left half, full height (primary card)
// - Slot 1: right half, top half
// - Slot 2: right half, bottom-left quarter
// - Slot 3: right half, bottom-right quarter
// Items not assigned to one of these slots are moved to a hidden 0×0 slot.
export const SLOT_LARGE_LEFT = 'top-0 left-0 h-full w-1/2'
export const SLOT_TOP_RIGHT_HALF = 'top-0 left-1/2 h-1/2 w-1/2'
export const SLOT_BOTTOM_RIGHT_LEFT_QUARTER = 'top-1/2 left-1/2 h-1/2 w-1/4'
export const SLOT_BOTTOM_RIGHT_RIGHT_QUARTER = 'top-1/2 left-3/4 h-1/2 w-1/4'
export const SLOT_HIDDEN = 'top-1/2 left-1/2 h-0 w-0'

const PARKING_SLOTS = [
  'top-[-18%] left-[-16%] h-2/5 w-2/5',
  'top-[-8%] left-[-24%] h-1/3 w-1/3',
  'top-[18%] left-[-20%] h-1/3 w-1/3',
  'top-[-18%] left-[76%] h-2/5 w-2/5',
  'top-[-10%] left-[88%] h-1/3 w-1/3',
  'top-[18%] left-[92%] h-1/3 w-1/3',
  'top-[70%] left-[76%] h-2/5 w-2/5',
  'top-[84%] left-[88%] h-1/3 w-1/3',
  'top-[54%] left-[92%] h-1/3 w-1/3',
  'top-[72%] left-[-18%] h-2/5 w-2/5',
  'top-[84%] left-[-24%] h-1/3 w-1/3',
  'top-[54%] left-[-22%] h-1/3 w-1/3',
] as const

function hashString(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function createSeededRandom(seedText: string): () => number {
  let state = hashString(seedText) || 1

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

export function createParkingSlotOrder(seedText: string): string[] {
  const slots: string[] = [...PARKING_SLOTS]
  const random = createSeededRandom(seedText)
  const fallbackSlot = PARKING_SLOTS[0] ?? SLOT_HIDDEN

  for (let index = slots.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const currentSlot = slots[index] ?? fallbackSlot
    slots[index] = slots[swapIndex] ?? currentSlot
    slots[swapIndex] = currentSlot
  }

  return slots
}

export function buildCategoryTabs(categories: LandingCategory[]): LandingCategory[] {
  const specialtyTabs = categories.filter((category) => category.value !== ALL_CATEGORY_VALUE)
  return [{ label: ALL_CATEGORY_LABEL, value: ALL_CATEGORY_VALUE }, ...specialtyTabs]
}

export function withSpecialtyQuery(href: string, specialtyId: string | null) {
  if (!href.startsWith('/') || href.startsWith('//')) return href

  const hashIndex = href.indexOf('#')
  const pathAndQuery = hashIndex >= 0 ? href.slice(0, hashIndex) : href
  const hash = hashIndex >= 0 ? href.slice(hashIndex + 1) : ''
  const [pathnameValue = '/', query = ''] = (pathAndQuery ?? '/').split('?')
  const pathname = pathnameValue.length > 0 ? pathnameValue : '/'
  const params = new URLSearchParams(query)

  if (specialtyId) {
    params.set('specialty', specialtyId)
  } else {
    params.delete('specialty')
  }

  const serializedParams = params.toString()
  const next = serializedParams ? `${pathname}?${serializedParams}` : pathname
  return hash.length > 0 ? `${next}#${hash}` : next
}
