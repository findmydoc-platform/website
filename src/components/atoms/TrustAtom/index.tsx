import React from 'react'

import { cn } from '@/utilities/ui'

import styles from './TrustAtom.module.css'

export type TrustAtomTone = 'primary' | 'accent' | 'secondary'

export type TrustAtomProps = {
  className?: string
  tone?: TrustAtomTone
  animated?: boolean
  floatDelay?: string
  floatDuration?: string
  floatLift?: string
  floatDrift?: string
}

export const TrustAtom: React.FC<TrustAtomProps> = ({
  className,
  tone = 'primary',
  animated = false,
  floatDelay,
  floatDuration,
  floatLift,
  floatDrift,
}) => {
  const style: React.CSSProperties = {
    ...(floatDelay ? { '--trust-atom-float-delay': floatDelay } : {}),
    ...(floatDuration ? { '--trust-atom-float-duration': floatDuration } : {}),
    ...(floatLift ? { '--trust-atom-float-lift': floatLift } : {}),
    ...(floatDrift ? { '--trust-atom-float-drift': floatDrift } : {}),
  } as React.CSSProperties

  return (
    <span
      className={cn(styles.root, styles[tone], animated && styles.animated, className)}
      style={style}
      aria-hidden="true"
    />
  )
}
