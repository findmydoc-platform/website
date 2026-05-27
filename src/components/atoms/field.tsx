import * as React from 'react'
import { CircleAlert } from 'lucide-react'

import { cn } from '@/utilities/ui'

const Field = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, role, ...props }, ref) => (
    <div
      ref={ref}
      role={role ?? 'group'}
      className={cn('group/field flex flex-col gap-2 data-[invalid=true]:text-secondary', className)}
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
        className={cn('inline-flex items-start gap-2 text-sm leading-5 font-medium text-destructive', className)}
        {...props}
      >
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{children}</span>
      </p>
    )
  },
)
FieldError.displayName = 'FieldError'

export { Field, FieldError }
