import React from 'react'

import type { Page } from '@/payload-types'

import RichText from '@/components/organisms/RichText'
import { Container } from '@/components/molecules/Container'

export const LowImpactHero: React.FC<Page['hero']> = ({ richText }) => {
  return (
    <Container className="mt-16">
      <div className="max-w-3xl">{richText && <RichText data={richText} enableGutter={false} />}</div>
    </Container>
  )
}
