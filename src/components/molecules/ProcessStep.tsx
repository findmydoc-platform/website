'use client'

import React from 'react'
import { motion, type Variants } from 'motion/react'

import { cn } from '@/utilities/ui'

export type ProcessStepProps = {
  step: number
  title: string
  description: string
  isActive: boolean
  isRevealed: boolean
  variants?: Variants
  className?: string
}

export const ProcessStep: React.FC<ProcessStepProps> = ({
  step,
  title,
  description,
  isActive,
  isRevealed,
  variants,
  className,
}) => {
  return (
    <motion.div
      className={cn('relative pl-12 lg:pl-16', className)}
      initial="hidden"
      animate={isRevealed ? 'visible' : 'hidden'}
      variants={variants}
    >
      <span
        className={cn(
          'absolute left-0 top-3 h-3 w-3 rounded-full border transition-colors duration-300 border-primary bg-primary',
        )}
      />
      <div className="flex flex-row items-start gap-4">
        <span
          className={cn(
            'w-14 shrink-0 tabular-nums text-5xl font-bold leading-none text-foreground transition-opacity duration-300',
            !isActive && isRevealed && 'text-foreground/80',
          )}
        >
          {step}.
        </span>
        <div className="min-w-0 flex flex-col pt-1">
          <h3
            className={cn(
              'mb-2 text-xl font-bold leading-snug text-foreground transition-opacity duration-300 text-left',
              !isActive && isRevealed && 'text-foreground/90',
            )}
          >
            {title}
          </h3>
          <p className="text-md leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
    </motion.div>
  )
}
