// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import {
  collectNativeValidationErrors,
  focusFirstInvalidControl,
  getNativeValidationMessage,
} from '@/components/molecules/PublicFormValidation'

const createForm = () => {
  const form = document.createElement('form')
  document.body.append(form)

  return form
}

describe('PublicFormValidation', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('maps required, email, and pattern constraints to central messages', () => {
    const form = createForm()
    const requiredInput = document.createElement('input')
    const emailInput = document.createElement('input')
    const postalCodeInput = document.createElement('input')

    requiredInput.name = 'name'
    requiredInput.required = true

    emailInput.name = 'email'
    emailInput.type = 'email'
    emailInput.value = 'not-an-email'

    postalCodeInput.name = 'postalCode'
    postalCodeInput.pattern = '[0-9]{5}'
    postalCodeInput.value = 'abc'

    form.append(requiredInput, emailInput, postalCodeInput)

    const result = collectNativeValidationErrors(form, {
      name: { valueMissing: 'Enter your name.' },
    })

    expect(result).toEqual({
      errors: {
        email: 'Enter a valid email address.',
        name: 'Enter your name.',
        postalCode: 'Enter a valid value.',
      },
      firstInvalidField: 'name',
    })
  })

  it('maps tooShort constraints when the browser exposes that validity flag', () => {
    const input = document.createElement('input')

    input.name = 'password'
    input.minLength = 8
    Object.defineProperty(input, 'validity', {
      value: {
        badInput: false,
        customError: false,
        patternMismatch: false,
        rangeOverflow: false,
        rangeUnderflow: false,
        stepMismatch: false,
        tooLong: false,
        tooShort: true,
        typeMismatch: false,
        valid: false,
        valueMissing: false,
      },
    })

    expect(getNativeValidationMessage(input)).toBe('Use at least 8 characters.')
  })

  it('skips disabled, hidden, unnamed, and valid controls', () => {
    const form = createForm()
    const validInput = document.createElement('input')
    const hiddenInput = document.createElement('input')
    const disabledInput = document.createElement('input')
    const unnamedInput = document.createElement('input')

    validInput.name = 'valid'
    validInput.required = true
    validInput.value = 'ok'

    hiddenInput.name = 'hidden'
    hiddenInput.type = 'hidden'
    hiddenInput.required = true

    disabledInput.name = 'disabled'
    disabledInput.required = true
    disabledInput.disabled = true

    unnamedInput.required = true

    form.append(validInput, hiddenInput, disabledInput, unnamedInput)

    expect(collectNativeValidationErrors(form)).toEqual({
      errors: {},
      firstInvalidField: null,
    })
  })

  it('focuses the first invalid control by field name', () => {
    const form = createForm()
    const emailInput = document.createElement('input')

    emailInput.name = 'email'
    form.append(emailInput)

    focusFirstInvalidControl(form, 'email')

    expect(document.activeElement).toBe(emailInput)
  })

  it('prefers the custom validation message when the browser exposes one', () => {
    const input = document.createElement('input')
    input.name = 'custom'
    input.setCustomValidity('Use another value.')

    expect(getNativeValidationMessage(input)).toBe('Use another value.')
  })
})
