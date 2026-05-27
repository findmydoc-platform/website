import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { ClinicAppointmentSection } from '@/components/organisms/ClinicDetail'
import type { ContactFormFields } from '@/components/organisms/ClinicDetail'
import type { ClinicDetailDoctor, ClinicDetailTreatment } from '@/components/templates/ClinicDetailConcepts/types'
import { clinicDetailFixture } from '@/stories/fixtures/clinicDetail'
import { withViewportStory } from '../../utils/viewportMatrix'

const doctors: ClinicDetailDoctor[] = clinicDetailFixture.doctors.slice(0, 3)
const treatments: ClinicDetailTreatment[] = clinicDetailFixture.treatments.slice(0, 4)
type ClinicAppointmentSectionArgs = React.ComponentProps<typeof ClinicAppointmentSection>

const initialFields: ContactFormFields = {
  fullName: '',
  phoneNumber: '',
  email: '',
  treatmentTimeline: '',
  preferredContactWindow: '',
  note: '',
  consentAccepted: false,
}

const submittedFields: ContactFormFields = {
  fullName: 'Jane Doe',
  phoneNumber: '+49 30 1234',
  email: 'jane@example.com',
  treatmentTimeline: 'within_two_weeks',
  preferredContactWindow: 'morning',
  note: 'I would like to discuss treatment options.',
  consentAccepted: true,
}

const meta = {
  title: 'Domain/Clinic/Organisms/ClinicDetail/ClinicAppointmentSection',
  component: ClinicAppointmentSection,
  args: {
    sectionId: 'clinic-contact-form-story',
    sectionRef: React.createRef<HTMLElement>(),
    fields: initialFields,
    selectedDoctorId: '',
    selectedTreatmentId: '',
    doctors,
    treatments,
    appointmentImage: clinicDetailFixture.beforeAfterEntries[0]?.after ?? clinicDetailFixture.heroImage,
    message: null,
    messageTone: 'success',
    selectionError: null,
    isSubmitting: false,
    isSubmitted: false,
    feedbackRef: React.createRef<HTMLDivElement>(),
    onFieldChange: fn(),
    onDoctorChange: fn(),
    onTreatmentChange: fn(),
    onSubmit: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Contact form section used in clinic detail with synchronized doctor/treatment selectors and persisted submit behavior.',
      },
    },
  },
  tags: ['autodocs', 'domain:clinic', 'layer:organism', 'status:stable', 'used-in:block:clinic-appointment-section'],
} satisfies Meta<typeof ClinicAppointmentSection>

export default meta

type Story = StoryObj<typeof meta>

function ClinicAppointmentSectionStoryHarness(args: Partial<ClinicAppointmentSectionArgs> = {}) {
  const resolvedArgs = { ...meta.args, ...args } as ClinicAppointmentSectionArgs
  const [fields, setFields] = React.useState<ContactFormFields>(resolvedArgs.fields)
  const [selectedDoctorId, setSelectedDoctorId] = React.useState(resolvedArgs.selectedDoctorId)
  const [selectedTreatmentId, setSelectedTreatmentId] = React.useState(resolvedArgs.selectedTreatmentId)
  const [message, setMessage] = React.useState<string | null>(resolvedArgs.message)
  const [messageTone, setMessageTone] = React.useState<'success' | 'error'>(resolvedArgs.messageTone)
  const [selectionError, setSelectionError] = React.useState(resolvedArgs.selectionError)
  const [isSubmitted, setIsSubmitted] = React.useState(resolvedArgs.isSubmitted)
  const sectionRef = React.useRef<HTMLElement | null>(null)
  const feedbackRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    setFields(resolvedArgs.fields)
    setSelectedDoctorId(resolvedArgs.selectedDoctorId)
    setSelectedTreatmentId(resolvedArgs.selectedTreatmentId)
    setMessage(resolvedArgs.message)
    setMessageTone(resolvedArgs.messageTone)
    setSelectionError(resolvedArgs.selectionError)
    setIsSubmitted(resolvedArgs.isSubmitted)
  }, [
    resolvedArgs.fields,
    resolvedArgs.isSubmitted,
    resolvedArgs.message,
    resolvedArgs.messageTone,
    resolvedArgs.selectedDoctorId,
    resolvedArgs.selectedTreatmentId,
    resolvedArgs.selectionError,
  ])

  return (
    <div className="bg-muted py-14">
      <div className="container-content">
        <ClinicAppointmentSection
          sectionId={resolvedArgs.sectionId}
          sectionRef={sectionRef}
          feedbackRef={feedbackRef}
          fields={fields}
          selectedDoctorId={selectedDoctorId}
          selectedTreatmentId={selectedTreatmentId}
          doctors={resolvedArgs.doctors}
          treatments={resolvedArgs.treatments}
          appointmentImage={resolvedArgs.appointmentImage}
          message={message}
          messageTone={messageTone}
          selectionError={selectionError}
          isSubmitting={resolvedArgs.isSubmitting}
          isSubmitted={isSubmitted}
          onFieldChange={(field, value) => {
            setFields((current) => ({ ...current, [field]: value }))
            setIsSubmitted(false)
            if (!selectionError) {
              setMessage(null)
              setMessageTone('success')
            }
            resolvedArgs.onFieldChange(field, value)
          }}
          onDoctorChange={(doctorId) => {
            setSelectedDoctorId(doctorId)
            setIsSubmitted(false)
            setMessage(null)
            setMessageTone('success')
            setSelectionError(null)
            resolvedArgs.onDoctorChange(doctorId)
          }}
          onTreatmentChange={(treatmentId) => {
            setSelectedTreatmentId(treatmentId)
            setIsSubmitted(false)
            setMessage(null)
            setMessageTone('success')
            setSelectionError(null)
            resolvedArgs.onTreatmentChange(treatmentId)
          }}
          onSubmit={(event) => {
            event.preventDefault()
            resolvedArgs.onSubmit(event)

            if (!selectedDoctorId && !selectedTreatmentId) {
              setMessageTone('error')
              setSelectionError('selection')
              setMessage('Select a doctor or treatment.')
              return
            }

            setMessageTone('success')
            setSelectionError(null)
            setMessage('Clinic request submitted for storybook preview.')
            setIsSubmitted(true)
          }}
        />
      </div>
    </div>
  )
}

export const InteractiveSubmit: Story = {
  render: (args) => <ClinicAppointmentSectionStoryHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByRole('textbox', { name: 'Full Name' }), 'Jane Doe')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Phone Number' }), '+49 30 1234')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Email' }), 'jane@example.com')
    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'How Soon Are You Considering Treatment?' }),
      'within_two_weeks',
    )
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'When Should We Contact You?' }), 'morning')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Message' }), 'I would like to discuss treatment options.')

    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Doctor' }), doctors[0]?.id ?? '')
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Treatment' }), treatments[1]?.id ?? '')
    await userEvent.click(canvas.getByRole('checkbox', { name: /process my contact details/i }))

    await userEvent.click(canvas.getByRole('button', { name: 'Submit Contact Request' }))
    await expect(canvas.getByRole('status')).toHaveTextContent('Clinic request submitted for storybook preview.')
  },
}

export const ErrorState: Story = {
  args: {
    message: 'Select a doctor or treatment.',
    messageTone: 'error',
    selectionError: 'selection',
  },
  render: (args) => <ClinicAppointmentSectionStoryHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const doctorSelect = canvas.getByRole('combobox', { name: 'Doctor' })
    const treatmentSelect = canvas.getByRole('combobox', { name: 'Treatment' })

    await expect(canvas.getByRole('alert')).toHaveTextContent('Select a doctor or treatment.')
    await expect(doctorSelect).toHaveAttribute('aria-invalid', 'true')
    await expect(treatmentSelect).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(doctorSelect).toHaveFocus())
  },
}

export const DoctorUnavailableErrorState: Story = {
  args: {
    selectedDoctorId: doctors[0]?.id ?? '',
    message: 'Doctor is not available for this clinic.',
    messageTone: 'error',
    selectionError: 'doctor',
  },
  render: (args) => <ClinicAppointmentSectionStoryHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const doctorSelect = canvas.getByRole('combobox', { name: 'Doctor' })
    const treatmentSelect = canvas.getByRole('combobox', { name: 'Treatment' })

    await expect(canvas.getByRole('alert')).toHaveTextContent('Doctor is not available for this clinic.')
    await expect(doctorSelect).toHaveValue(doctors[0]?.id ?? '')
    await expect(doctorSelect).toHaveAttribute('aria-invalid', 'true')
    await expect(treatmentSelect).not.toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(doctorSelect).toHaveFocus())

    await userEvent.type(canvas.getByRole('textbox', { name: 'Full Name' }), 'Jane Doe')
    await expect(canvas.getByRole('alert')).toHaveTextContent('Doctor is not available for this clinic.')
    await expect(doctorSelect).toHaveAttribute('aria-invalid', 'true')
  },
}

export const TreatmentUnavailableErrorState: Story = {
  args: {
    selectedTreatmentId: treatments[0]?.id ?? '',
    message: 'Treatment is not available for this clinic.',
    messageTone: 'error',
    selectionError: 'treatment',
  },
  render: (args) => <ClinicAppointmentSectionStoryHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const doctorSelect = canvas.getByRole('combobox', { name: 'Doctor' })
    const treatmentSelect = canvas.getByRole('combobox', { name: 'Treatment' })

    await expect(canvas.getByRole('alert')).toHaveTextContent('Treatment is not available for this clinic.')
    await expect(treatmentSelect).toHaveValue(treatments[0]?.id ?? '')
    await expect(doctorSelect).not.toHaveAttribute('aria-invalid', 'true')
    await expect(treatmentSelect).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(treatmentSelect).toHaveFocus())
  },
}

export const SubmittingState: Story = {
  args: {
    isSubmitting: true,
  },
  render: (args) => <ClinicAppointmentSectionStoryHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Sending Request...' })

    await expect(button).toBeDisabled()
  },
}

export const SubmittedState: Story = {
  args: {
    fields: submittedFields,
    selectedDoctorId: doctors[0]?.id ?? '',
    selectedTreatmentId: treatments[1]?.id ?? '',
    isSubmitted: true,
    message: 'Your clinic request has been sent successfully.',
    messageTone: 'success',
  },
  render: (args) => <ClinicAppointmentSectionStoryHarness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Request sent' })

    await expect(button).toBeDisabled()
    await expect(canvas.getByRole('status')).toHaveTextContent('Your clinic request has been sent successfully.')
  },
}

export const ValidationAndSubmit: Story = {
  render: () => <ClinicAppointmentSectionStoryHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Submit Contact Request' }))

    await waitFor(() => {
      expect(canvas.getByText('Enter your full name.')).toBeInTheDocument()
    })

    await userEvent.type(canvas.getByRole('textbox', { name: 'Full Name' }), 'Jane Doe')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Phone Number' }), '+49 30 1234')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Email' }), 'jane@example.com')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Message' }), 'I would like to discuss treatment options.')

    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Doctor' }), doctors[0]?.id ?? '')
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Treatment' }), treatments[1]?.id ?? '')
    await userEvent.click(canvas.getByRole('checkbox', { name: /process my contact details/i }))

    await userEvent.click(canvas.getByRole('button', { name: 'Submit Contact Request' }))
    await expect(canvas.getByRole('status')).toHaveTextContent('Clinic request submitted for storybook preview.')
  },
}

export const InteractiveSubmit320: Story = withViewportStory(InteractiveSubmit, 'public320', 'Interactive submit / 320')
export const InteractiveSubmit375: Story = withViewportStory(InteractiveSubmit, 'public375', 'Interactive submit / 375')
export const InteractiveSubmit640: Story = withViewportStory(InteractiveSubmit, 'public640', 'Interactive submit / 640')
export const InteractiveSubmit768: Story = withViewportStory(InteractiveSubmit, 'public768', 'Interactive submit / 768')
export const InteractiveSubmit1024: Story = withViewportStory(
  InteractiveSubmit,
  'public1024',
  'Interactive submit / 1024',
)
export const InteractiveSubmit1280: Story = withViewportStory(
  InteractiveSubmit,
  'public1280',
  'Interactive submit / 1280',
)
export const ValidationAndSubmit320: Story = withViewportStory(
  ValidationAndSubmit,
  'public320',
  'Validation and submit / 320',
)
export const ValidationAndSubmit375: Story = withViewportStory(
  ValidationAndSubmit,
  'public375',
  'Validation and submit / 375',
)
