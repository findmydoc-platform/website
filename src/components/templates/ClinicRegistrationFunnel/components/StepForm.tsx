import type * as React from 'react'

import type { PublicFormValidationController } from '../types'

export function StepForm({
  ariaBusy,
  ariaLabelledBy,
  children,
  onSubmit,
  validation,
}: {
  ariaBusy?: boolean
  ariaLabelledBy: string
  children: React.ReactNode
  onSubmit: (form: HTMLFormElement) => Promise<void> | void
  validation: PublicFormValidationController
}) {
  return (
    <form
      aria-busy={ariaBusy ? true : undefined}
      aria-labelledby={ariaLabelledBy}
      className="flex min-w-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        if (!validation.validateForm(event.currentTarget)) return

        void onSubmit(event.currentTarget)
      }}
      onInvalid={validation.handleInvalid}
      noValidate
    >
      {children}
    </form>
  )
}
