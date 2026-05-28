export type NativeValidationMessageType =
  | 'badInput'
  | 'patternMismatch'
  | 'rangeOverflow'
  | 'rangeUnderflow'
  | 'stepMismatch'
  | 'tooLong'
  | 'tooShort'
  | 'typeMismatch'
  | 'valueMissing'
  | 'customError'

export type NativeValidationMessageOverrides = Partial<Record<NativeValidationMessageType, string>>

export type NativeValidationMessageOverridesByField = Record<string, NativeValidationMessageOverrides>

export type NativeValidationResult = {
  errors: Record<string, string>
  firstInvalidField: string | null
}

type NativeFormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

function isNativeFormControl(element: Element): element is NativeFormControl {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  )
}

function getMessageOverride(
  fieldName: string,
  type: NativeValidationMessageType,
  overrides?: NativeValidationMessageOverridesByField,
): string | undefined {
  return overrides?.[fieldName]?.[type]
}

export function getNativeValidationMessage(
  control: NativeFormControl,
  overrides?: NativeValidationMessageOverridesByField,
): string {
  const { validity, name } = control

  if (validity.valueMissing) return getMessageOverride(name, 'valueMissing', overrides) ?? 'This field is required.'
  if (validity.typeMismatch) {
    return getMessageOverride(name, 'typeMismatch', overrides) ?? 'Enter a valid email address.'
  }
  if (validity.tooShort) {
    return (
      getMessageOverride(name, 'tooShort', overrides) ??
      `Use at least ${control.getAttribute('minlength') ?? 'the required number of'} characters.`
    )
  }
  if (validity.tooLong) {
    return (
      getMessageOverride(name, 'tooLong', overrides) ??
      `Use no more than ${control.getAttribute('maxlength') ?? 'the allowed number of'} characters.`
    )
  }
  if (validity.patternMismatch) {
    return getMessageOverride(name, 'patternMismatch', overrides) ?? 'Enter a valid value.'
  }
  if (validity.rangeUnderflow) {
    return getMessageOverride(name, 'rangeUnderflow', overrides) ?? 'Enter a higher value.'
  }
  if (validity.rangeOverflow) {
    return getMessageOverride(name, 'rangeOverflow', overrides) ?? 'Enter a lower value.'
  }
  if (validity.stepMismatch) {
    return getMessageOverride(name, 'stepMismatch', overrides) ?? 'Enter a valid step value.'
  }
  if (validity.badInput) {
    return getMessageOverride(name, 'badInput', overrides) ?? 'Enter a valid value.'
  }
  if (validity.customError) {
    return getMessageOverride(name, 'customError', overrides) ?? control.validationMessage
  }

  return control.validationMessage || 'Enter a valid value.'
}

export function collectNativeValidationErrors(
  form: HTMLFormElement,
  overrides?: NativeValidationMessageOverridesByField,
): NativeValidationResult {
  const errors: Record<string, string> = {}
  let firstInvalidField: string | null = null

  for (const element of Array.from(form.elements)) {
    if (!isNativeFormControl(element) || !element.name || element.disabled || element.type === 'hidden') continue
    if (element.validity.valid) continue

    errors[element.name] = getNativeValidationMessage(element, overrides)
    firstInvalidField ??= element.name
  }

  return { errors, firstInvalidField }
}

export function focusFirstInvalidControl(form: HTMLFormElement, fieldName: string | null): void {
  if (!fieldName) return

  const escapedName = globalThis.CSS?.escape?.(fieldName) ?? fieldName.replaceAll('"', '\\"')
  const control = form.querySelector<HTMLElement>(`[name="${escapedName}"], [data-field-name="${escapedName}"]`)

  control?.focus()
}
