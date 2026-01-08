import type { Meta, StoryObj } from '@storybook/react-vite'
import Image from 'next/image'
import React, { useEffect, useState } from 'react'

import { GlowTuner } from '@/components/molecules/GlowTuner'
import type { GlowUnderlayValue } from '@/components/atoms/glow'

import placeholderTall from '@/stories/assets/placeholder-576-968.png'

type GlowTunerStoryProps = {
  value: GlowUnderlayValue
}

const GlowTunerStory = ({ value: initialValue }: GlowTunerStoryProps) => {
  const [value, setValue] = useState<GlowUnderlayValue>(initialValue)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          className="hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium shadow-sm"
          onClick={async () => {
            const snippet = `import { GlowUnderlay } from '@/components/atoms/glow'\n\n<GlowUnderlay\n  enabled={${value.enabled}}\n  desktopOnly={${value.desktopOnly}}\n  size={${value.size}}\n  offsetX={${value.offsetX}}\n  offsetY={${value.offsetY}}\n  shape={${value.shape}}\n  intensity={${value.intensity}}\n  falloff={${value.falloff}}\n  color={"${value.color}"}\n/>`
            try {
              await navigator.clipboard.writeText(snippet)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            } catch {
              // noop: clipboard may not be available in some contexts
            }
          }}
        >
          <span>{copied ? 'Copied' : 'Copy code'}</span>
        </button>
      </div>

      <GlowTuner.Root value={value} onValueChange={setValue} className="items-start">
        <GlowTuner.Controls />
        <GlowTuner.Preview>
          {/* Storybook-safe: local, deterministic asset */}
          <div className="relative h-full w-full">
            <Image src={placeholderTall} alt="Placeholder" fill className="object-cover" unoptimized />
          </div>
        </GlowTuner.Preview>
      </GlowTuner.Root>
    </div>
  )
}

const meta = {
  title: 'Molecules/GlowTuner',
  component: GlowTunerStory,
  parameters: {
    layout: 'padded',
    demoFrame: {
      maxWidth: '2xl',
      padded: true,
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof GlowTunerStory>

export default meta

type Story = StoryObj<typeof meta>

const DEFAULT_VALUE: GlowUnderlayValue = {
  enabled: true,
  desktopOnly: false,
  size: 110,
  offsetX: 0,
  offsetY: 20,
  shape: 100,
  intensity: 100,
  falloff: 100,
  color: 'primary',
}

export const Default: Story = {
  args: {
    value: DEFAULT_VALUE,
  },
}
