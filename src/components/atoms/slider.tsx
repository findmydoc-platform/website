'use client'

import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/utilities/ui'

export type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>

export const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ className, value, defaultValue, ...props }, ref) => {
    const resolvedValues = (value ?? defaultValue ?? [0]) as number[]

    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn('relative flex w-full touch-none select-none items-center', className)}
        value={value}
        defaultValue={defaultValue}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full rounded-full bg-muted">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
        </SliderPrimitive.Track>
        {resolvedValues.map((_, index) => (
          <SliderPrimitive.Thumb
            // Radix uses index-based keys internally; mirroring that here is fine.
            key={index}
            className="block h-4 w-4 rounded-full border-2 border-primary bg-background shadow"
          />
        ))}
      </SliderPrimitive.Root>
    )
  },
)

Slider.displayName = 'Slider'
