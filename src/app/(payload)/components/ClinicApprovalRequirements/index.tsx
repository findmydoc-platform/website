'use client'

import { useFormFields } from '@payloadcms/ui'
import type { GenericErrorProps } from 'payload'

import { clinicApprovalRequirementSet } from '@/collections/clinics/approvalRequirements'
import { RequirementsChecklist } from '@/app/(payload)/components/RequirementsChecklist'
import { ConditionalRequirementFieldError } from '@/app/(payload)/components/ConditionalRequirementFieldError'

export function ClinicApprovalRequirementError(props: GenericErrorProps) {
  const requirement = clinicApprovalRequirementSet.requirements.find(({ path }) => path === props.path)
  const fieldState = useFormFields(([fields]) => ({
    status: fields.status?.value,
    value: props.path ? fields[props.path]?.value : undefined,
  }))

  if (!requirement) {
    return <ConditionalRequirementFieldError {...props} conditionalMessage="" isMissing={false} />
  }

  return (
    <ConditionalRequirementFieldError
      {...props}
      conditionalMessage={requirement.message}
      isMissing={fieldState.status === 'approved' && !requirement.valueIsPresent(fieldState.value)}
    />
  )
}

export function ClinicApprovalRequirements() {
  const formSnapshot = useFormFields(([fields]) => ({
    status: fields.status?.value,
    values: clinicApprovalRequirementSet.requirements.map((requirement) => fields[requirement.path]?.value),
  }))

  const items = clinicApprovalRequirementSet.requirements.map((requirement, index) => ({
    id: requirement.path,
    label: requirement.label,
    status: requirement.valueIsPresent(formSnapshot.values[index]) ? ('complete' as const) : ('incomplete' as const),
  }))

  return (
    <RequirementsChecklist
      inactiveSummary="These values become required when the clinic status is Approved."
      isEnforced={formSnapshot.status === 'approved'}
      items={items}
      title="Approval requirements"
    />
  )
}
