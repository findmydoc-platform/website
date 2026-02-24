import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from '@storybook/test'

import {
  ClinicDetailConceptA,
  ClinicDetailConceptB,
  ClinicDetailConceptC,
} from '@/components/templates/ClinicDetailConcepts'
import {
  clinicDetailFixture,
  clinicDetailNoCoordinatesFixture,
  clinicDetailNoLocationFixture,
  clinicDetailNoReviewsFixture,
} from '@/stories/fixtures/clinicDetail'

const meta = {
  title: 'Templates/ClinicDetailConcepts',
  component: ClinicDetailConceptA,
  args: {
    data: clinicDetailFixture,
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Three desktop-only clinic detail concepts with identical data and intentionally different UI/UX emphasis: Figma-refined, transparency-first, and doctor-directory-first.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ClinicDetailConceptA>

export default meta

type Story = StoryObj<typeof meta>

export const ConceptA_FigmaRefined: Story = {
  render: (args) => <ClinicDetailConceptA {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: 'Our Doctors' })).toBeInTheDocument()
    const contactLinks = canvas.getAllByRole('link', { name: 'Contact Clinic' })
    await expect(contactLinks.length).toBeGreaterThan(0)
    await expect(contactLinks[0]).toHaveAttribute('href', '/contact?clinic=berlin-health-clinic&source=clinic-detail')

    await expect(canvas.getByText('From $120')).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Select Dr. Isabela Costa' })).not.toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Show more doctors' }))
    await expect(canvas.getByRole('button', { name: 'Select Dr. Isabela Costa' })).toBeInTheDocument()
  },
}

export const ConceptB_TransparencyFirst: Story = {
  args: {
    data: clinicDetailFixture,
  },
  render: (args) => <ClinicDetailConceptB {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: 'Trust Signals' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Transparent Pricing' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Our Doctors' })).toBeInTheDocument()
  },
}

export const ConceptC_DoctorDirectoryFirst: Story = {
  args: {
    data: clinicDetailFixture,
  },
  render: (args) => <ClinicDetailConceptC {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: 'Our Doctors' })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Select Dr. Lukas Stein' }))
    await expect(canvas.getByRole('heading', { name: 'Dr. Lukas Stein' })).toBeInTheDocument()
  },
}

export const Edge_NoCoordinates_AddressFallback: Story = {
  args: {
    data: clinicDetailNoCoordinatesFixture,
  },
  render: (args) => <ClinicDetailConceptA {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const mapLink = canvas.getByRole('link', { name: 'Open in OpenStreetMap' })
    await expect(mapLink).toHaveAttribute('href')
    await expect(mapLink.getAttribute('href') ?? '').toContain('search?query=')
  },
}

export const Edge_NoLocation_HideMap: Story = {
  args: {
    data: clinicDetailNoLocationFixture,
  },
  render: (args) => <ClinicDetailConceptA {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('heading', { name: 'Location & Contact' })).not.toBeInTheDocument()
  },
}

export const Edge_NoReviews_FallbackText: Story = {
  args: {
    data: clinicDetailNoReviewsFixture,
  },
  render: (args) => <ClinicDetailConceptA {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('No reviews yet').length).toBeGreaterThan(0)
  },
}
