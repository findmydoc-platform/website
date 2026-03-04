import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from '@storybook/test'

import { ClinicLocationSection } from '@/components/organisms/ClinicDetail'
import { buildOpenStreetMapHref } from '@/components/templates/ClinicDetailConcepts'
import { clinicDetailFixture } from '@/stories/fixtures/clinicDetail'

const mapHref = buildOpenStreetMapHref(clinicDetailFixture.location)

const meta = {
  title: 'Templates/ClinicDetail/Map Location',
  component: ClinicLocationSection,
  args: {
    clinicName: clinicDetailFixture.clinicName,
    location: clinicDetailFixture.location,
    mapHref,
    onContactClick: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Clinic location section using the selected Hero Map with Floating Address Card layout, including directions, contact jump, and map expansion.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ClinicLocationSection>

export default meta

type Story = StoryObj<typeof meta>

export const HeroMapFloatingCard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: 'Clinic Location' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Directions' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Contact' })).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Expand map' }))
    await expect(canvas.getByRole('button', { name: 'Close map' })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Close map' }))
    await expect(canvas.getByRole('button', { name: 'Expand map' })).toBeInTheDocument()
  },
}
