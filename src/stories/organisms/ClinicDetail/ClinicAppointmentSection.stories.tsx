import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from '@storybook/test'

import { ClinicAppointmentSection } from '@/components/organisms/ClinicDetail'
import type { ContactFormFields } from '@/components/organisms/ClinicDetail'
import type { ClinicDetailDoctor, ClinicDetailTreatment } from '@/components/templates/ClinicDetailConcepts/types'
import { clinicDetailFixture } from '@/stories/fixtures/clinicDetail'
import { withViewportStory } from '../../utils/viewportMatrix'

const doctors: ClinicDetailDoctor[] = clinicDetailFixture.doctors.slice(0, 3)
const treatments: ClinicDetailTreatment[] = clinicDetailFixture.treatments.slice(0, 4)

const initialFields: ContactFormFields = {
  fullName: '',
  phoneNumber: '',
  email: '',
  preferredDate: '',
  preferredTime: '',
  note: '',
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
    selectedDoctorName: undefined,
    selectedTreatmentName: undefined,
    doctors,
    treatments,
    appointmentImage: clinicDetailFixture.beforeAfterEntries[0]?.after ?? clinicDetailFixture.heroImage,
    message: null,
    onFieldChange: fn(),
    onDoctorChange: fn(),
    onTreatmentChange: fn(),
    onSubmit: fn(),
    onResetFields: fn(),
    onClearSelections: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Contact form section used in clinic detail with synchronized doctor/treatment selectors and placeholder submit behavior.',
      },
    },
  },
  tags: ['autodocs', 'domain:clinic', 'layer:organism', 'status:stable', 'used-in:block:clinic-appointment-section'],
} satisfies Meta<typeof ClinicAppointmentSection>

export default meta

type Story = StoryObj<typeof meta>

function ClinicAppointmentSectionStoryHarness() {
  const [fields, setFields] = React.useState<ContactFormFields>(initialFields)
  const [selectedDoctorId, setSelectedDoctorId] = React.useState('')
  const [selectedTreatmentId, setSelectedTreatmentId] = React.useState('')
  const [message, setMessage] = React.useState<string | null>(null)
  const sectionRef = React.useRef<HTMLElement | null>(null)

  const selectedDoctorName = doctors.find((doctor) => doctor.id === selectedDoctorId)?.name
  const selectedTreatmentName = treatments.find((treatment) => treatment.id === selectedTreatmentId)?.name

  return (
    <div className="bg-muted py-14">
      <div className="container-content">
        <ClinicAppointmentSection
          sectionId="clinic-contact-form"
          sectionRef={sectionRef}
          fields={fields}
          selectedDoctorId={selectedDoctorId}
          selectedTreatmentId={selectedTreatmentId}
          selectedDoctorName={selectedDoctorName}
          selectedTreatmentName={selectedTreatmentName}
          doctors={doctors}
          treatments={treatments}
          appointmentImage={clinicDetailFixture.beforeAfterEntries[0]?.after ?? clinicDetailFixture.heroImage}
          message={message}
          onFieldChange={(field, value) => {
            setFields((current) => ({ ...current, [field]: value }))
            setMessage(null)
          }}
          onDoctorChange={(doctorId) => {
            setSelectedDoctorId(doctorId)
            setMessage(null)
          }}
          onTreatmentChange={(treatmentId) => {
            setSelectedTreatmentId(treatmentId)
            setMessage(null)
          }}
          onSubmit={(event) => {
            event.preventDefault()
            setMessage('Contact request prepared for storybook preview.')
          }}
          onResetFields={() => {
            setFields(initialFields)
            setMessage(null)
          }}
          onClearSelections={() => {
            setSelectedDoctorId('')
            setSelectedTreatmentId('')
            setMessage(null)
          }}
        />
      </div>
    </div>
  )
}

export const InteractiveSubmit: Story = {
  render: () => <ClinicAppointmentSectionStoryHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByRole('textbox', { name: 'Full Name' }), 'Jane Doe')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Phone Number' }), '+49 30 1234')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Email' }), 'jane@example.com')

    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Doctor' }), doctors[0]?.id ?? '')
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Treatment' }), treatments[1]?.id ?? '')

    await userEvent.click(canvas.getByRole('button', { name: 'Submit Contact Request' }))
    await expect(canvas.getByRole('status')).toHaveTextContent('Contact request prepared for storybook preview.')
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
