'use client'

import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/utilities/ui'

export type SliderProps = Omit<
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
  'value' | 'defaultValue' | 'onValueChange'
> & {
  value: number[]
  onValueChange: (value: number[]) => void
}

export const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ className, value, onValueChange, ...props }, ref) => {
    const resolvedValues = React.useMemo(() => (value.length ? value : [0]), [value])
    const activeThumbIndexRef = React.useRef<number | null>(null)

    const handleValueChange = React.useCallback(
      (nextValues: number[]) => {
        if (nextValues.length < 2 || resolvedValues.length < 2) {
          onValueChange(nextValues)
          return
        }

        const currentMin = resolvedValues[0] ?? nextValues[0] ?? 0
        const currentMax = resolvedValues[1] ?? nextValues[1] ?? currentMin
        const nextMin = nextValues[0] ?? currentMin
        const nextMax = nextValues[1] ?? currentMax
        const activeIndex =
          activeThumbIndexRef.current ??
          (Math.abs(nextMin - currentMin) >= Math.abs(nextMax - currentMax) ? 0 : 1)

        const clampedValues =
          activeIndex === 0
            ? ([Math.min(nextMin, currentMax), currentMax] as number[])
            : activeIndex === 1
              ? ([currentMin, Math.max(nextMax, currentMin)] as number[])
              : nextValues

        onValueChange(clampedValues)
      },
      [onValueChange, resolvedValues],
    )

    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn('relative flex w-full touch-none items-center select-none', className)}
        value={resolvedValues}
        onValueChange={handleValueChange}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full rounded-full bg-muted">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
        </SliderPrimitive.Track>
        {resolvedValues.map((_, index) => (
          <SliderPrimitive.Thumb
            // Radix uses index-based keys internally; mirroring that here is fine.
            key={index}
            onPointerDown={() => {
              activeThumbIndexRef.current = index
            }}
            onKeyDown={() => {
              activeThumbIndexRef.current = index
            }}
            className="block h-4 w-4 rounded-full border-2 border-primary bg-background shadow"
          />
        ))}
      </SliderPrimitive.Root>
    )
  },
)

Slider.displayName = 'Slider'
