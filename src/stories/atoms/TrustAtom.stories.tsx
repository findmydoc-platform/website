import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { TrustAtom } from '@/components/atoms/TrustAtom'

const meta: Meta<typeof TrustAtom> = {
  title: 'Shared/Atoms/TrustAtom',
  component: TrustAtom,
  tags: ['autodocs', 'domain:shared', 'layer:atom', 'status:stable'],
  parameters: {
    docs: {
      description: {
        component: 'Decorative trust atom marker used around the about-page trust system.',
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof TrustAtom>

export const Variants: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <TrustAtom tone="primary" animated />
      <TrustAtom tone="accent" animated />
      <TrustAtom tone="secondary" animated />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const atoms = Array.from(canvasElement.querySelectorAll('[aria-hidden="true"]'))

    await expect(atoms).toHaveLength(3)
    await expect(atoms[0]).toHaveClass(/primary/)
    await expect(atoms[1]).toHaveClass(/accent/)
    await expect(atoms[2]).toHaveClass(/secondary/)
    for (const atom of atoms) {
      await expect(atom).toHaveClass(/animated/)
    }
    await expect(canvas.queryByText(/primary|accent|secondary/i)).not.toBeInTheDocument()
  },
}
