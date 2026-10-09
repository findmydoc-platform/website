import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/atoms/command'

const navigationItems = [{ label: 'Clinics Dashboard' }, { label: 'Doctors' }, { label: 'Blog Posts' }]

const actionItems = [{ label: 'Create Clinic' }, { label: 'Invite Staff' }, { label: 'Open Support' }]

type CommandPreviewProps = {
  searchPlaceholder: string
  showEmptyState: boolean
}

const CommandPreview: React.FC<CommandPreviewProps> = ({ searchPlaceholder, showEmptyState }) => {
  return (
    <Command className="mx-auto w-full max-w-lg border">
      <CommandInput placeholder={searchPlaceholder} />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        {!showEmptyState && (
          <>
            <CommandGroup heading="Navigate">
              {navigationItems.map((item) => (
                <CommandItem key={item.label} onSelect={() => {}}>
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Actions">
              {actionItems.map((item) => (
                <CommandItem key={item.label} onSelect={() => {}}>
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  )
}

const meta = {
  title: 'Shared/Atoms/Command',
  component: CommandPreview,
  tags: ['autodocs', 'domain:shared', 'layer:atom', 'status:stable', 'used-in:shared'],
  argTypes: {
    showEmptyState: {
      control: 'boolean',
    },
  },
  args: {
    searchPlaceholder: 'Search for anything…',
    showEmptyState: false,
  },
} satisfies Meta<typeof CommandPreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async () => {
    const canvas = within(document.body)
    const input = canvas.getByPlaceholderText('Search for anything…')

    await userEvent.type(input, 'Clinic')

    expect(canvas.getByText('Clinics Dashboard')).toBeVisible()
    expect(canvas.getByText('Create Clinic')).toBeVisible()
  },
}

export const EmptyState: Story = {
  args: {
    showEmptyState: false,
    searchPlaceholder: 'Try typing to narrow results…',
  },
  play: async () => {
    const canvas = within(document.body)
    const input = canvas.getByPlaceholderText('Try typing to narrow results…')

    await userEvent.type(input, 'zzzz')

    expect(canvas.getByText('No matching commands.')).toBeVisible()
  },
}
