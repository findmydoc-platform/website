import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'

import { PatientTrustOrbit, type PatientTrustOrbitProps } from '@/components/organisms/PatientTrustOrbit'
import { withViewportStory } from '../utils/viewportMatrix'

const createMatchMedia = (prefersReducedMotion: boolean): typeof window.matchMedia => {
  return ((query: string) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: query.includes('prefers-reduced-motion') ? prefersReducedMotion : false,
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  })) as typeof window.matchMedia
}

const patientTrustOrbitArgs = {
  eyebrow: 'Our approach',
  title: 'Clinic decisions patients can trust.',
  description:
    'findmydoc helps patients compare clinics through standardized profiles, reviewed trust signals, and a direct inquiry flow.',
  points: [
    'We make clinic information comparable, even when marketing budgets are not.',
    'We review trust signals through standards, accreditations, and verified patient feedback.',
    'We keep the next step direct so patients know who they are speaking with.',
  ],
  coreLabel: 'Patient trust',
  how: ['Standardize', 'Verify', 'Compare'],
  outcomes: [
    {
      label: 'Comparable profiles',
      description: 'Clinic information follows one clear structure, not each clinic’s marketing budget.',
    },
    {
      label: 'Reviewed trust signals',
      description: 'Accreditations, standards, and verified patient feedback make quality easier to assess.',
    },
    {
      label: 'Direct inquiry',
      description: 'Patients can move from comparison to clinic contact without opaque handoffs.',
    },
  ],
} satisfies PatientTrustOrbitProps

const longContentArgs = {
  ...patientTrustOrbitArgs,
  title: 'Clinic decisions patients can trust before they take the next step.',
  description:
    'findmydoc helps patients understand clinic options through consistent information, reviewed trust signals, and a direct inquiry path that keeps the decision focused on treatment fit rather than marketing visibility.',
  points: [
    'We standardize how clinics present treatments, qualification signals, languages, and service details so patients can compare options without rebuilding the whole picture themselves.',
    'We combine objective trust inputs, local standards, international accreditations, and verified patient feedback into signals that are easier to understand.',
    'We support a direct inquiry flow that keeps ownership clear and avoids hiding the clinic relationship behind an opaque intermediary layer.',
  ],
  outcomes: [
    {
      label: 'Comparable clinic profiles',
      description:
        'Patients see clinic information in a consistent structure, so strong clinics are easier to evaluate even without the largest marketing budget.',
    },
    {
      label: 'Reviewed trust and quality signals',
      description:
        'Accreditations, standards, certifications, and verified patient feedback are presented as decision support instead of scattered claims.',
    },
    {
      label: 'Direct patient inquiry',
      description:
        'The path from comparison to contact stays clear, traceable, and focused on the clinic that can answer the patient’s specific case.',
    },
  ],
} satisfies PatientTrustOrbitProps

const meta = {
  title: 'Internal/Landing/Organisms/PatientTrustOrbit',
  component: PatientTrustOrbit,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Story-first prototype for the about-page Golden Circle component. It keeps the current page untouched until the visual direction is approved.',
      },
    },
  },
  tags: ['autodocs', 'domain:landing', 'layer:organism', 'status:experimental', 'used-in:shared'],
  args: patientTrustOrbitArgs,
} satisfies Meta<typeof PatientTrustOrbit>

export default meta

type Story = StoryObj<typeof meta>

const ReducedMotionPreview = (args: PatientTrustOrbitProps) => {
  const [isReady, setIsReady] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const originalMatchMedia = window.matchMedia
    window.matchMedia = createMatchMedia(true)
    setIsReady(true)

    return () => {
      window.matchMedia = originalMatchMedia
    }
  }, [])

  if (!isReady) return null

  return <PatientTrustOrbit {...args} />
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.findByRole('heading', { name: /clinic decisions patients can trust/i }),
    ).resolves.toBeInTheDocument()
    expect(canvas.getByText('Patient trust')).toBeInTheDocument()
    expect(canvas.getByText('Standardize')).toBeInTheDocument()
    expect(canvas.getByText('Verify')).toBeInTheDocument()
    expect(canvas.getByText('Compare')).toBeInTheDocument()
    expect(canvas.getByText('Comparable profiles')).toBeInTheDocument()
    expect(canvas.getByText('Reviewed trust signals')).toBeInTheDocument()
    expect(canvas.getByText('Direct inquiry')).toBeInTheDocument()
  },
}

export const Mobile: Story = withViewportStory(Default, 'public375', 'Mobile')

export const ReducedMotion: Story = {
  render: (args) => <ReducedMotionPreview {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const heading = await canvas.findByRole('heading', { name: /clinic decisions patients can trust/i })
    const root = heading.closest<HTMLElement>('[data-patient-trust-orbit]')

    expect(root).not.toBeNull()
    if (!root) return

    await waitFor(() => {
      expect(root.dataset.patientTrustMotion).toBe('reduced')
      expect(root.dataset.patientTrustState).toBe('visible')
    })
    expect(root.querySelector('[data-patient-trust-webgl]')).toBeNull()
  },
}

export const LongContent: Story = {
  args: longContentArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.findByRole('heading', { name: /before they take the next step/i })).resolves.toBeInTheDocument()
    expect(canvas.getByText('Comparable clinic profiles')).toBeInTheDocument()
    expect(canvas.getByText('Reviewed trust and quality signals')).toBeInTheDocument()
    expect(canvas.getByText('Direct patient inquiry')).toBeInTheDocument()
  },
}
