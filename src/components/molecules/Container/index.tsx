import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'
import { Slot } from '@radix-ui/react-slot'

import { cn } from '@/utilities/ui'

export const containerVariants = cva('mx-auto w-full px-6 sm:px-8 lg:px-12 xl:px-20 2xl:px-32', {
  variants: {
    variant: {
      default: 'container-content',
      base: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

type ContainerProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof containerVariants> & {
    asChild?: boolean
  }

export const Container: React.FC<ContainerProps> = ({ className, variant, asChild = false, ...props }) => {
  const Comp = asChild ? Slot : 'div'
  return <Comp className={cn(containerVariants({ variant }), className)} {...props} />
}
