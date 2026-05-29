import type * as React from 'react'

import type { PublicFormValidationController } from '../types'

export function StepForm({
  ariaLabelledBy,
  children,
  onSubmit,
  validation,
}: {
  ariaLabelledBy: string
  children: React.ReactNode
  onSubmit: (form: HTMLFormElement) => void
  validation: PublicFormValidationController
}) {
  return (
    <form
      aria-labelledby={ariaLabelledBy}
      className="flex min-w-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        if (!validation.validateForm(event.currentTarget)) return

        onSubmit(event.currentTarget)
      }}
      onInvalid={validation.handleInvalid}
      noValidate
    >
      {children}
    </form>
  )
}
