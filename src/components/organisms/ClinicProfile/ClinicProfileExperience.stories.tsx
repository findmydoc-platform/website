import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { clinicDetailFixture } from '@/stories/fixtures/clinicDetail'
import { ClinicProfileExperience, type ClinicProfileExperienceProps } from './ClinicProfileExperience'

const realisticFixture = {
  ...clinicDetailFixture,
  doctors: clinicDetailFixture.doctors.map((doctor, index) =>
    index === 0
      ? doctor
      : { ...doctor, image: { src: '/images/placeholders/doctor-neutral-placeholder.webp', alt: '' } },
  ),
}

const meta = {
  title: 'Domain/Clinic/Organisms/ClinicProfileExperience',
  component: ClinicProfileExperience,
  args: {
    data: realisticFixture,
    favorite: { isPatient: true, saved: false, onToggle: () => {}, onSignIn: () => {} },
    share: { url: 'https://example.test/clinic', onCopy: async () => {} },
    map: { allowed: false },
    selectedDoctorId: null,
    selectedTreatmentId: null,
    onDoctorChange: () => {},
    onTreatmentChange: () => {},
  },
  render: (args) => <ControlledExperience {...args} />,
  decorators: [
    (Story) => (
      <div
        onClickCapture={(event) => {
          if ((event.target as HTMLElement).closest('a')) event.preventDefault()
        }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs', 'domain:clinic', 'layer:organism', 'status:experimental', 'used-in:route:/clinics/[slug]'],
} satisfies Meta<typeof ClinicProfileExperience>
export default meta
type Story = StoryObj<typeof meta>

function ControlledExperience(args: ClinicProfileExperienceProps) {
  const [doctor, setDoctor] = React.useState<string | null>(args.selectedDoctorId)
  const [treatment, setTreatment] = React.useState<string | null>(args.selectedTreatmentId)
  return (
    <ClinicProfileExperience
      {...args}
      selectedDoctorId={doctor}
      selectedTreatmentId={treatment}
      onDoctorChange={setDoctor}
      onTreatmentChange={setTreatment}
    />
  )
}

export const Discovery: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /treatments/i }))
    const search = canvas.getByRole('searchbox', { name: /search treatments/i })
    await userEvent.type(search, 'Genetic Counseling')
    await expect(canvas.getByRole('heading', { name: 'Genetic Counseling' })).toBeVisible()
    const select = canvas.getByRole('button', { name: /select Genetic Counseling for inquiry/i })
    await userEvent.click(select)
    await expect(select).toHaveAttribute('aria-pressed', 'true')
    const detail = canvas.getByRole('button', { name: /treatment details for Genetic Counseling/i })
    await userEvent.click(detail)
    await expect(await within(document.body).findByRole('dialog')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect(detail).toHaveFocus()
  },
}

export const Sparse: Story = {
  args: {
    data: { ...clinicDetailFixture, treatments: [], doctors: [], galleryImages: [], description: '', location: {} },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: 'Treatments' }))
    await expect(canvas.getByRole('tabpanel', { name: 'Treatments' })).toBeVisible()
    await expect(canvas.queryByRole('searchbox')).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('tab', { name: 'Doctors' }))
    await expect(canvas.getByRole('tabpanel', { name: 'Doctors' })).toBeVisible()
    await expect(canvas.queryByRole('searchbox')).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('tab', { name: /reviews/i }))
    await expect(canvas.getByRole('tabpanel', { name: /reviews/i })).toBeVisible()
  },
}

const discoveryData = {
  ...clinicDetailFixture,
  treatments: [
    { id: 'zero', name: 'Alpha consultation', category: 'Diagnostics', priceFrom: 0 },
    ...clinicDetailFixture.treatments,
  ],
  doctors: [
    {
      ...clinicDetailFixture.doctors[0]!,
      id: 'generic',
      name: 'Dr. Alex Example',
      specialty: 'General Practice',
      languages: ['Swedish'],
    },
    ...realisticFixture.doctors.slice(1),
  ],
}

export const FilteringAndSelection: Story = {
  args: { data: discoveryData },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /treatments/i }))
    await expect(within(canvas.getByRole('tabpanel', { name: /treatments/i })).getByText('From €0.00')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /select Alpha consultation for inquiry/i }))
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Previous' }))
    await expect(
      canvas.getByRole('button', { name: /Alpha consultation, selected for your inquiry/i }),
    ).toHaveAttribute('aria-pressed', 'true')
    const search = canvas.getByRole('searchbox', { name: /search treatments/i })
    await userEvent.type(search, 'no-such-treatment')
    await expect(canvas.queryByRole('button', { name: /treatment details for/i })).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /reset filters/i }))
    await expect(search).toHaveFocus()
    await expect(
      canvas.getByRole('button', { name: /Alpha consultation, selected for your inquiry/i }),
    ).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(canvas.getByRole('tab', { name: /doctors/i }))
    const specialty = canvas.getByRole('combobox', { name: /filter by specialty/i })
    await expect(within(specialty).queryByRole('option', { name: 'General Practice' })).not.toBeInTheDocument()
    await userEvent.type(canvas.getByRole('searchbox', { name: /search name/i }), 'Swedish')
    await expect(canvas.getByRole('heading', { name: 'Dr. Alex Example' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /choose Dr. Alex Example for inquiry/i }))
    const details = canvas.getByRole('button', { name: /view profile for Dr. Alex Example/i })
    await userEvent.click(details)
    const dialog = await within(document.body).findByRole('dialog')
    await expect(within(dialog).queryByText('General Practice')).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await expect(details).toHaveFocus()
    await userEvent.click(canvas.getByRole('tab', { name: /treatments/i }))
    await expect(
      canvas.getByRole('button', { name: /Alpha consultation, selected for your inquiry/i }),
    ).toHaveAttribute('aria-pressed', 'true')
  },
}
