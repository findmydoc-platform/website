import { cn } from '@/utilities/ui'
import React from 'react'

export const Container: React.FC<{
  className?: string
  children: React.ReactNode
}> = ({ className, children }) => {
  return <div className={cn('w-full px-4 md:px-6 lg:px-8', className)}>{children}</div>
}
