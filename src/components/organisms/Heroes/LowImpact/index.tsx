import React from 'react'
import { Container } from '@/components/molecules/Container'

export type LowImpactHeroProps = {
  richText?: React.ReactNode
}

export const LowImpactHero: React.FC<LowImpactHeroProps> = ({ richText }) => {
  return (
    <Container className="mt-16">
      <div className="max-w-3xl">{richText}</div>
    </Container>
  )
}
