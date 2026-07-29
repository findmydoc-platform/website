'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { TextField, useField } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'

import { normalizeOpeningHoursTimeInput } from './normalizeOpeningHoursTimeInput'

const openingHoursTimeInputDescription = 'Accepts 8, 08, 8:00, and 08:00.'

export const OpeningHoursTimeField: TextFieldClientComponent = (props) => {
  const wrapperRef = useRef<HTMLDivElement>(null)
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

  const normalizeValue = useCallback(() => {
    if (typeof value !== 'string') return

    const normalizedValue = normalizeOpeningHoursTimeInput(value)
    if (normalizedValue !== null && normalizedValue !== value) {
      setValue(normalizedValue)
    }
  }, [setValue, value])

  useEffect(() => {
    const form = wrapperRef.current?.closest('form')
    if (!form) return

    form.addEventListener('submit', normalizeValue, true)
    return () => form.removeEventListener('submit', normalizeValue, true)
  }, [normalizeValue])

  return (
    <div ref={wrapperRef} onBlurCapture={normalizeValue}>
      <TextField {...props} field={field} />
    </div>
  )
}
