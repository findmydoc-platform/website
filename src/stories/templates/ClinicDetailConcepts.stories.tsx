import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { ClinicDetail } from '@/components/templates/ClinicDetailConcepts'
import { clinicDetailFixture, clinicDetailNoReviewsFixture } from '@/stories/fixtures/clinicDetail'
import { withViewportStory } from '../utils/viewportMatrix'

const meta = {
  title: 'Domain/Clinic/Templates/ClinicDetail',
  component: ClinicDetail,
  args: {
    data: clinicDetailFixture,
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Main desktop clinic detail concept with synchronized doctor/treatment contact flow and a real contact form.',
      },
    },
  },
  tags: ['autodocs', 'domain:clinic', 'layer:template', 'status:stable', 'used-in:route:/clinics/[slug]'],
} satisfies Meta<typeof ClinicDetail>

export default meta

type Story = StoryObj<typeof meta>

export const Main_Default: Story = {
  render: (args) => <ClinicDetail {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: 'Berlin Health Clinic' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Treatments' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Further Treatments' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Our Doctors' })).toBeInTheDocument()

    const contactDoctorLinks = canvas.getAllByRole('link', { name: 'Contact Doctor' })
    await expect(contactDoctorLinks.length).toBeGreaterThan(0)
    await expect(contactDoctorLinks[0]).toHaveAttribute('href', '#clinic-contact-form')

    const doctorSelect = canvas.getByRole('combobox', { name: 'Doctor' })
    const treatmentSelect = canvas.getByRole('combobox', { name: 'Treatment' })

    await expect(doctorSelect).toHaveValue('')
    await expect(treatmentSelect).toHaveValue('')
  },
}

export const Edge_NoReviews_FallbackText: Story = {
  args: {
    data: clinicDetailNoReviewsFixture,
  },
  render: (args) => <ClinicDetail {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('No reviews yet').length).toBeGreaterThan(0)
  },
}

export const MainDefault320: Story = withViewportStory(Main_Default, 'public320', 'Main default / 320')
export const MainDefault375: Story = withViewportStory(Main_Default, 'public375', 'Main default / 375')
export const MainDefault640: Story = withViewportStory(Main_Default, 'public640', 'Main default / 640')
export const MainDefault768: Story = withViewportStory(Main_Default, 'public768', 'Main default / 768')
export const MainDefault1024: Story = withViewportStory(Main_Default, 'public1024', 'Main default / 1024')
export const MainDefault1280: Story = withViewportStory(Main_Default, 'public1280', 'Main default / 1280')
