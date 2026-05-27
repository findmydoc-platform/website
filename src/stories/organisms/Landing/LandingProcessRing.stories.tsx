import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

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
  haloSaturation: 0.5,
  haloLightness: 0.55,
  flareTint: 0.55,
  lightSurfaceFade: 0.8,
  organicness: 0,
  density: 0.58,
  speed: 0.15,
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
          'Animated onboarding process ring with a shader-driven glow renderer. The story keeps only the controls that have a clear visual effect on the ring.',
      },
    },
  },
  tags: ['autodocs', 'domain:landing', 'layer:organism', 'status:experimental', 'used-in:shared'],
  argTypes: {
    title: {
      control: false,
    },
    preset: {
      control: false,
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
      control: false,
    },
    size: {
      control: false,
    },
    startAngle: {
      control: false,
    },
    endAngle: {
      control: false,
    },
    orbitMargin: {
      control: false,
    },
    logoScale: {
      control: false,
    },
    vibrancy: {
      control: { type: 'number', min: 0, max: 1, step: 0.01 },
    },
    colorBalance: {
      control: false,
    },
    haloSaturation: {
      control: false,
    },
    haloLightness: {
      control: false,
    },
    flareTint: {
      control: false,
    },
    lightSurfaceFade: {
      control: false,
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
      control: false,
    },
    logoAlt: {
      control: false,
    },
    steps: {
      control: false,
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
