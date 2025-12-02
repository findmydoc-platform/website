import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
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
  parameters: {
    layout: 'centered',
  },
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

export const Default: Story = {}

export const EmptyState: Story = {
  args: {
    showEmptyState: true,
    searchPlaceholder: 'Try typing to narrow results…',
  },
}
