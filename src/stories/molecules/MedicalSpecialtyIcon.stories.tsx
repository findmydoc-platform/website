import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { MedicalSpecialtyIcon } from '@/components/molecules/MedicalSpecialtyIcon'
import { medicalSpecialtyIconOptions } from '@/utilities/medicalSpecialties/iconKeys'

const meta = {
  title: 'Shared/Molecules/MedicalSpecialtyIcon',
  component: MedicalSpecialtyIcon,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs', 'domain:medical-network', 'layer:molecule', 'status:experimental', 'used-in:shared'],
  args: {
    iconKey: 'fallback',
  },
} satisfies Meta<typeof MedicalSpecialtyIcon>

export default meta

type Story = StoryObj<typeof meta>

export const Fallback: Story = {
  render: (args) => (
    <div className="flex size-16 items-center justify-center rounded-2xl border border-slate-200 bg-white text-primary">
      <MedicalSpecialtyIcon {...args} aria-label="Fallback specialty icon" className="size-8" role="img" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('img', { name: 'Fallback specialty icon' })).toBeInTheDocument()
  },
}

export const IconSet: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {medicalSpecialtyIconOptions.map((option) => (
        <div
          className="flex min-w-32 flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm font-semibold text-slate-800"
          key={option.value}
        >
          <MedicalSpecialtyIcon
            aria-label={`${option.label} specialty icon`}
            className="size-8 text-primary"
            iconKey={option.value}
            role="img"
          />
          <span>{option.label}</span>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getAllByRole('img')).toHaveLength(medicalSpecialtyIconOptions.length)
  },
}
