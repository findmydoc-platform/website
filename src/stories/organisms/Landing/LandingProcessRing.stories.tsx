import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import {
  LandingProcessRing,
  landingProcessRingDefaultSteps,
  type LandingProcessRingProps,
} from '@/components/organisms/Landing'
import { withViewportStory } from '../../utils/viewportMatrix'

const screenshotMatchArgs = {
  title: 'How It Works for Patients',
  preset: 'balanced',
  palette: 'brand',
  size: 620,
  startAngle: 25,
  endAngle: 335,
  orbitMargin: 0,
  logoScale: 1.7,
  backgroundColor: '#ffffff',
  accentColor: '#42E2B7',
  primaryColor: '#0076FF',
  vibrancy: 1,
  colorBalance: 0.4,
  organicness: 0,
  density: 0.58,
  speed: 0.61,
  wobble: 0.62,
  glow: 1,
  steps: landingProcessRingDefaultSteps,
} satisfies LandingProcessRingProps

const meta = {
  title: 'Domain/Landing/Organisms/LandingProcessRing',
  component: LandingProcessRing,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Animated onboarding process ring derived from the organic ring exploration. The story exposes ring motion, color, orbit, and logo props through standard Storybook controls.',
      },
    },
  },
  tags: ['autodocs', 'domain:landing', 'layer:organism', 'status:experimental', 'used-in:shared'],
  argTypes: {
    title: {
      control: 'text',
    },
    preset: {
      control: 'select',
      options: ['calm', 'balanced', 'wild'],
    },
    palette: {
      control: 'select',
      options: ['brand', 'ocean', 'mint', 'ice', 'mono'],
    },
    accentColor: {
      control: 'color',
    },
    primaryColor: {
      control: 'color',
    },
    backgroundColor: {
      control: 'color',
    },
    size: {
      control: { type: 'number', min: 320, max: 900, step: 10 },
    },
    startAngle: {
      control: { type: 'number', min: 0, max: 359, step: 1 },
    },
    endAngle: {
      control: { type: 'number', min: 0, max: 359, step: 1 },
    },
    orbitMargin: {
      control: { type: 'number', min: -120, max: 240, step: 2 },
    },
    logoScale: {
      control: { type: 'number', min: 0, max: 3, step: 0.05 },
    },
    vibrancy: {
      control: { type: 'number', min: 0, max: 1, step: 0.01 },
    },
    colorBalance: {
      control: { type: 'number', min: 0, max: 1, step: 0.01 },
    },
    organicness: {
      control: { type: 'number', min: 0, max: 1, step: 0.01 },
    },
    density: {
      control: { type: 'number', min: 0, max: 1, step: 0.01 },
    },
    speed: {
      control: { type: 'number', min: 0, max: 1, step: 0.01 },
    },
    wobble: {
      control: { type: 'number', min: 0, max: 1, step: 0.01 },
    },
    glow: {
      control: { type: 'number', min: 0, max: 1, step: 0.01 },
    },
    logoSrc: {
      control: 'text',
    },
    logoAlt: {
      control: 'text',
    },
    steps: {
      control: 'object',
    },
    className: {
      control: false,
    },
  },
} satisfies Meta<typeof LandingProcessRing>

export default meta

type Story = StoryObj<typeof meta>

const assertStorySteps: Story['play'] = async ({ args, canvasElement }) => {
  const canvas = within(canvasElement)
  const stepTitles = args.steps?.map((step) => step.title) ?? []

  await expect(canvas.getByTestId('landing-process-ring')).toBeInTheDocument()

  for (const title of stepTitles) {
    await expect(canvas.getAllByText(title).length).toBeGreaterThan(0)
  }
}

export const BalancedDefault: Story = {
  args: {
    steps: landingProcessRingDefaultSteps,
  },
  play: assertStorySteps,
}

export const ScreenshotMatch: Story = {
  args: {
    ...screenshotMatchArgs,
  },
  play: assertStorySteps,
}

export const NoLogo: Story = {
  args: {
    ...screenshotMatchArgs,
    logoSrc: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByTestId('landing-process-ring')).toBeInTheDocument()
    await expect(canvas.queryByAltText('findmydoc')).not.toBeInTheDocument()
  },
}

export const ScreenshotMatch320: Story = withViewportStory(ScreenshotMatch, 'public320', 'Screenshot match / 320')
export const ScreenshotMatch375: Story = withViewportStory(ScreenshotMatch, 'public375', 'Screenshot match / 375')
export const ScreenshotMatch640: Story = withViewportStory(ScreenshotMatch, 'public640', 'Screenshot match / 640')
export const ScreenshotMatch768: Story = withViewportStory(ScreenshotMatch, 'public768', 'Screenshot match / 768')
export const ScreenshotMatch1024: Story = withViewportStory(ScreenshotMatch, 'public1024', 'Screenshot match / 1024')
export const ScreenshotMatch1280: Story = withViewportStory(ScreenshotMatch, 'public1280', 'Screenshot match / 1280')
export const ScreenshotMatch320Short: Story = withViewportStory(
  ScreenshotMatch,
  'public320Short',
  'Screenshot match / 320 short',
)
export const ScreenshotMatch375Short: Story = withViewportStory(
  ScreenshotMatch,
  'public375Short',
  'Screenshot match / 375 short',
)
