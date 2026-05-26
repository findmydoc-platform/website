import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from '@storybook/test'

import { ClinicLocationSection } from '@/components/organisms/ClinicDetail'
import { buildOpenStreetMapHref } from '@/components/templates/ClinicDetailConcepts'
import { clinicDetailFixture } from '@/stories/fixtures/clinicDetail'

const mapHref = buildOpenStreetMapHref(clinicDetailFixture.location)
const mapEmbedHref = `data:text/html;charset=utf-8,${encodeURIComponent(`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      html,
      body {
        height: 100%;
        margin: 0;
      }

      body {
        align-items: center;
        background:
          linear-gradient(90deg, rgb(210 221 230 / 0.7) 1px, transparent 1px),
          linear-gradient(rgb(210 221 230 / 0.7) 1px, transparent 1px),
          linear-gradient(135deg, #eef6f1, #dfe9f8);
        background-size:
          48px 48px,
          48px 48px,
          cover;
        color: #0f2e46;
        display: flex;
        font-family: system-ui, sans-serif;
        justify-content: center;
      }

      .zoom {
        position: absolute;
        right: 12px;
        top: 12px;
      }

      .zoom button {
        background: white;
        border: 1px solid rgb(15 46 70 / 0.22);
        color: #0f2e46;
        display: block;
        font: 700 18px/1 system-ui, sans-serif;
        height: 30px;
        width: 30px;
      }

      .marker {
        align-items: center;
        background: #6ea64c;
        border: 3px solid white;
        border-radius: 999px;
        box-shadow: 0 12px 24px rgb(15 46 70 / 0.24);
        color: white;
        display: flex;
        font-size: 14px;
        font-weight: 700;
        height: 48px;
        justify-content: center;
        width: 48px;
      }
    </style>
  </head>
  <body aria-label="Mock OpenStreetMap embed">
    <div class="zoom" aria-label="Native map zoom controls">
      <button type="button" aria-label="Zoom in">+</button>
      <button type="button" aria-label="Zoom out">-</button>
    </div>
    <div class="marker" aria-hidden="true">OSM</div>
  </body>
</html>
`)}`

const meta = {
  title: 'Domain/Clinic/Templates/ClinicDetail/Map Location',
  component: ClinicLocationSection,
  args: {
    clinicName: clinicDetailFixture.clinicName,
    location: clinicDetailFixture.location,
    mapHref,
    mapEmbedHref,
    isOpenStreetMapAllowed: true,
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
  tags: ['autodocs', 'domain:clinic', 'layer:template', 'status:stable', 'used-in:route:/clinics/[slug]'],
} satisfies Meta<typeof ClinicLocationSection>

export default meta

type Story = StoryObj<typeof meta>

export const HeroMapFloatingCard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: 'Clinic Location' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Directions' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Contact' })).toBeInTheDocument()
    await expect(canvas.getByTitle(`Map preview of ${clinicDetailFixture.clinicName}`)).not.toHaveClass(
      /pointer-events-none/,
    )
    await expect(canvas.getByTitle(`Map preview of ${clinicDetailFixture.clinicName}`)).toHaveAttribute('tabindex', '0')
    await expect(canvas.getByTestId('map-preview-interaction-guard')).toBeInTheDocument()
    await expect(canvas.getByTestId('map-preview-interaction-guard-top')).toHaveClass(/right-\[72px\]/)
    await expect(canvas.getByTestId('map-preview-interaction-guard-body')).toHaveClass(/top-\[120px\]/)

    await userEvent.click(canvas.getByRole('button', { name: 'Expand map' }))
    const page = within(document.body)

    await expect(page.getByRole('button', { name: 'Close map' })).toBeInTheDocument()
    const interactiveMap = page.getByTitle(`Interactive map of ${clinicDetailFixture.clinicName}`)

    await expect(page.getByRole('link', { name: 'View map in OpenStreetMap' })).toBeInTheDocument()
    await expect(interactiveMap).not.toHaveClass(/pointer-events-none/)
    await expect(page.queryByRole('group', { name: 'Expanded map keyboard controls' })).not.toBeInTheDocument()
    await expect(page.queryByRole('button', { name: 'Pan map north' })).not.toBeInTheDocument()
    await expect(page.queryByRole('button', { name: 'Zoom map in' })).not.toBeInTheDocument()
    await expect(page.queryByRole('button', { name: 'Reset map view' })).not.toBeInTheDocument()
    await userEvent.click(page.getByRole('button', { name: 'Close map' }))
    await expect(canvas.getByRole('button', { name: 'Expand map' })).toBeInTheDocument()
  },
}

export const HiddenUntilConsent: Story = {
  args: {
    isOpenStreetMapAllowed: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: 'Clinic Location' })).toBeInTheDocument()
    await expect(canvas.getByText('OpenStreetMap is hidden until optional cookies are accepted.')).toBeInTheDocument()
    await expect(canvas.queryByRole('link', { name: 'Directions' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Expand map' })).not.toBeInTheDocument()
  },
}
