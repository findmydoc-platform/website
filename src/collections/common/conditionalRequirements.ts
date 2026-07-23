import type { Operation, Validate, ValidationFieldError } from 'payload'

export type ConditionalRequirement = Readonly<{
  label: string
  marker: string
  message: string
  path: string
  valueIsPresent: (value: unknown) => boolean
}>

export type ConditionalRequirementContext = Readonly<{
  data: unknown
  operation?: Operation
}>

export type ConditionalRequirementSet = Readonly<{
  collection: string
  isRequired: (context: ConditionalRequirementContext) => boolean
  requirements: readonly ConditionalRequirement[]
}>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const readValueAtPath = (data: unknown, path: string): unknown => {
  if (!isRecord(data)) return undefined

  return path.split('.').reduce<unknown>((value, segment) => {
    if (!isRecord(value)) return undefined
    return value[segment]
  }, data)
}

export const getMissingConditionalRequirements = (
  requirementSet: ConditionalRequirementSet,
  context: ConditionalRequirementContext,
): readonly ConditionalRequirement[] => {
  if (!requirementSet.isRequired(context)) return []

  return requirementSet.requirements.filter(
    (requirement) => !requirement.valueIsPresent(readValueAtPath(context.data, requirement.path)),
  )
}

export const toValidationFieldErrors = (requirements: readonly ConditionalRequirement[]): ValidationFieldError[] =>
  requirements.map(({ label, message, path }) => ({
    label,
    message,
    path,
  }))

export const createConditionalRequiredValidator = <TValue, TData, TSiblingData, TFieldConfig extends object>(
  baseValidate: Validate<TValue, TData, TSiblingData, TFieldConfig>,
  requirementSet: ConditionalRequirementSet,
  requirement: ConditionalRequirement,
): Validate<TValue, TData, TSiblingData, TFieldConfig> => {
  return async (value, options) => {
    const baseResult = await baseValidate(value, options)
    if (baseResult !== true) return baseResult

    if (!requirementSet.isRequired({ data: options.data, operation: options.operation })) return true

    return requirement.valueIsPresent(value) ? true : requirement.message
  }
}
