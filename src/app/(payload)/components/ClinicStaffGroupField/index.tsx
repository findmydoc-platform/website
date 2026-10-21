'use client'

import { RelationshipField, useFormFields, useFormSubmitted } from '@payloadcms/ui'
import type { RelationshipFieldClientProps } from 'payload'

import {
  groupAssignmentRequirement,
  groupAssignmentRequirementSet,
} from '@/collections/clinicStaff/groupAssignmentRequirements'

import './index.scss'

export function ClinicStaffGroupField(props: RelationshipFieldClientProps) {
  const submitted = useFormSubmitted()
  const { assignmentScope, fieldState } = useFormFields(([fields]) => ({
    assignmentScope: fields.assignmentScope?.value,
    fieldState: fields[props.path],
  }))
  const isRequired = groupAssignmentRequirementSet.isRequired({ data: { assignmentScope } })
  const isMissing = isRequired && !groupAssignmentRequirement.valueIsPresent(fieldState?.value)
  const errorMessage = isMissing ? groupAssignmentRequirement.message : fieldState?.errorMessage
  const errorId = `${props.path.replaceAll('.', '__')}-assignment-error`
  const hasError = Boolean(submitted && (isMissing || fieldState?.valid === false) && errorMessage)

  return (
    <fieldset
      aria-label="Group"
      aria-invalid={hasError || undefined}
      aria-describedby={hasError ? errorId : undefined}
      className="clinic-staff-group-field"
    >
      <RelationshipField {...props} field={{ ...props.field, required: isRequired }} />
      {hasError && (
        <p className="clinic-staff-group-field__error" id={errorId} role="alert">
          {errorMessage}
        </p>
      )}
    </fieldset>
  )
}

export function ClinicStaffGroupTooltipError() {
  return null
}
