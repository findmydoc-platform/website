import { cn } from '@/utilities/ui'
import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'
import { Slot } from '@radix-ui/react-slot'

export const containerVariants = cva('mx-auto w-full px-6 lg:px-8', {
  variants: {
    variant: {
      default: 'max-w-(--layout-content-max)',
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
