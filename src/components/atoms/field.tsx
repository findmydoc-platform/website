import * as React from 'react'
import { CircleAlert } from 'lucide-react'

import { cn } from '@/utilities/ui'

const Field = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, role, ...props }, ref) => (
    <div
      ref={ref}
      role={role ?? 'group'}
      className={cn('group/field flex flex-col gap-1.5 data-[invalid=true]:text-secondary', className)}
      {...props}
    />
  ),
)
Field.displayName = 'Field'

const FieldError = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => {
    if (!children) return null

    return (
      <p
        ref={ref}
        role="alert"
        className={cn('inline-flex items-start gap-1.5 text-xs leading-4 font-normal text-destructive/90', className)}
        {...props}
      >
        <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        <span>{children}</span>
      </p>
    )
  },
)
FieldError.displayName = 'FieldError'

export { Field, FieldError }
