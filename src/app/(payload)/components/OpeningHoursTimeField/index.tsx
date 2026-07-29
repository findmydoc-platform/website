'use client'

import { useCallback, useMemo } from 'react'
import { TextField, useField } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'

import { normalizeOpeningHoursTimeInput } from './normalizeOpeningHoursTimeInput'

const openingHoursTimeInputDescription = 'Accepts 8, 08, 8:00, and 08:00.'

export const OpeningHoursTimeField: TextFieldClientComponent = (props) => {
  const { setValue, value } = useField<string>({ path: props.path })
  const field = useMemo(
    () => ({
      ...props.field,
      admin: {
        ...props.field.admin,
        description: openingHoursTimeInputDescription,
      },
    }),
    [props.field],
  )

  const handleBlur = useCallback(() => {
    if (typeof value !== 'string') return

    const normalizedValue = normalizeOpeningHoursTimeInput(value)
    if (normalizedValue !== null && normalizedValue !== value) {
      setValue(normalizedValue)
    }
  }, [setValue, value])

  return (
    <div onBlurCapture={handleBlur}>
      <TextField {...props} field={field} />
    </div>
  )
}
