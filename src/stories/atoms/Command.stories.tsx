import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from '@storybook/test'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/atoms/command'

const navigationItems = [
  { label: 'Clinics Dashboard', shortcut: '⌘D' },
  { label: 'Doctors', shortcut: '⌘⇧D' },
  { label: 'Blog Posts', shortcut: '⌘B' },
]

const actionItems = [
  { label: 'Create Clinic', shortcut: '⌘N' },
  { label: 'Invite Staff', shortcut: '⌘I' },
  { label: 'Open Support', shortcut: '⌘/' },
]

type CommandPreviewProps = {
  searchPlaceholder: string
  showEmptyState: boolean
  open: boolean
}

const CommandPreview: React.FC<CommandPreviewProps> = ({ open, searchPlaceholder, showEmptyState }) => {
  const [isOpen, setIsOpen] = React.useState(open)

  React.useEffect(() => {
    setIsOpen(open)
  }, [open])

  return (
    <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
      <CommandInput placeholder={searchPlaceholder} />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        {!showEmptyState && (
          <>
            <CommandGroup heading="Navigate">
              {navigationItems.map((item) => (
                <CommandItem key={item.label} onSelect={() => {}}>
                  {item.label}
                  <CommandShortcut>{item.shortcut}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              {actionItems.map((item) => (
                <CommandItem key={item.label} onSelect={() => {}}>
                  {item.label}
                  <CommandShortcut>{item.shortcut}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}

const meta = {
  title: 'Atoms/Command',
  component: CommandPreview,
  tags: ['autodocs'],
  argTypes: {
    showEmptyState: {
      control: 'boolean',
    },
    open: {
      control: 'boolean',
    },
  },
  args: {
    open: true,
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
