import React from 'react'

import type { Page } from '@/payload-types'

import { HighImpactHero } from '@/components/organisms/Heroes/HighImpact'
import { LowImpactHero } from '@/components/organisms/Heroes/LowImpact'
import { MediumImpactHero } from '@/components/organisms/Heroes/MediumImpact'

const heroes = {
  highImpact: HighImpactHero,
  lowImpact: LowImpactHero,
  mediumImpact: MediumImpactHero,
}

export const RenderHero: React.FC<Page['hero']> = (props) => {
  const { type } = props || {}

  if (!type || type === 'none') return null

  const HeroToRender = heroes[type]

  if (!HeroToRender) return null

  return <HeroToRender {...props} />
}
