import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { useRef, useState } from 'react'

import {
  ClinicDashboardOverview,
  ClinicMessagesWorkspace,
  ClinicProfileDialogBackdrop,
  ClinicProfileEditor,
  ClinicReviewsManagement,
  TeamMemberDialog,
  TreatmentDialog,
} from '@/components/templates/ClinicDashboardPrototype'
import {
  clinicDashboardShellFixture,
  clinicProfileCatalogFixture,
  clinicProfileFixture,
  clinicTeamBackdropFixture,
  dashboardOverviewFixture,
  messagesWorkspaceFixture,
  patientProfileFixture,
  reviewsManagementFixture,
  teamMemberDialogFixture,
  treatmentDialogFixture,
} from '@/stories/fixtures'
import {
  FULL_VIEWPORT_MATRIX_PARAMETERS,
  PUBLIC_STORYBOOK_VIEWPORTS,
  withViewportStory,
} from '@/stories/utils/viewportMatrix'

const noAction = () => undefined

function DashboardHarness({ navigationInitiallyOpen = false }: { navigationInitiallyOpen?: boolean }) {
  const [navigationOpen, setNavigationOpen] = useState(navigationInitiallyOpen)
  return (
    <ClinicDashboardOverview
      data={dashboardOverviewFixture}
      mobileNavigationOpen={navigationOpen}
      onAction={noAction}
      onMobileNavigationOpenChange={setNavigationOpen}
      shell={clinicDashboardShellFixture}
    />
  )
}

function MessagesHarness({ profileInitiallyOpen = false }: { profileInitiallyOpen?: boolean }) {
  const [profileOpen, setProfileOpen] = useState(profileInitiallyOpen)
  return (
    <ClinicMessagesWorkspace
      data={messagesWorkspaceFixture}
      onAction={noAction}
      onPatientProfileOpenChange={setProfileOpen}
      patientProfile={patientProfileFixture}
      patientProfileOpen={profileOpen}
      shell={clinicDashboardShellFixture}
    />
  )
}

function TreatmentDialogHarness({ initiallyOpen = true }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const setDialogOpen = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) requestAnimationFrame(() => triggerRef.current?.focus())
  }
  return (
    <>
      <ClinicProfileDialogBackdrop
        data={clinicProfileCatalogFixture}
        dialogTriggerRef={triggerRef}
        onAction={(action) => {
          if (action === 'add-treatment') setOpen(true)
        }}
        shell={clinicDashboardShellFixture}
      />
      <TreatmentDialog data={treatmentDialogFixture} onAction={noAction} onOpenChange={setDialogOpen} open={open} />
    </>
  )
}

function TeamMemberDialogHarness({ initiallyOpen = true }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const setDialogOpen = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) requestAnimationFrame(() => triggerRef.current?.focus())
  }
  return (
    <>
      <ClinicProfileDialogBackdrop
        data={clinicTeamBackdropFixture}
        dialogTriggerRef={triggerRef}
        onAction={(action) => {
          if (action === 'add-team-member') setOpen(true)
        }}
        shell={clinicDashboardShellFixture}
      />
      <TeamMemberDialog data={teamMemberDialogFixture} onAction={noAction} onOpenChange={setDialogOpen} open={open} />
    </>
  )
}

const meta = {
  title: 'Internal/ClinicOperations/Templates/ClinicDashboardPrototype',
  parameters: {
    ...FULL_VIEWPORT_MATRIX_PARAMETERS,
    a11y: { test: 'error' },
    controls: { disable: true },
    docs: {
      description: {
        component:
          'Static Storybook-only clinic operations prototype based on the selected Stitch screens. No route, API, persistence, authentication, or analytics integration is included.',
      },
    },
    layout: 'fullscreen',
    viewport: { options: PUBLIC_STORYBOOK_VIEWPORTS },
  },
  tags: ['autodocs', 'domain:clinic-operations', 'layer:template', 'status:experimental', 'used-in:shared'],
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const DashboardOverview: Story = {
  render: () => <DashboardHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument()
    await expect(canvas.getByText('Profil-Vollständigkeit')).toBeInTheDocument()
    await expect(canvas.getAllByText('18.420').length).toBeGreaterThanOrEqual(2)
    await expect(canvas.getByRole('progressbar', { name: 'Profil-Vollständigkeit: 82%' })).toHaveAttribute(
      'aria-valuenow',
      '82',
    )
    await expect(canvas.getByText('Prozessoptimierung aktiv')).toBeInTheDocument()
  },
}

export const MessagesDefault: Story = {
  render: () => <MessagesHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Nachrichten', level: 1 })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /Lukas Weber/ })).toHaveAttribute('aria-current', 'page')
    await expect(canvas.getByText(messagesWorkspaceFixture.messages[0]?.body ?? '')).toBeInTheDocument()
    await expect(canvas.getByText('2+ Fotos')).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: /Patientenakte ansehen/i }))
    const page = within(canvasElement.ownerDocument.body)
    await expect(page.getByRole('dialog', { name: 'Patientenprofil' })).toBeInTheDocument()
    await expect(page.getByText('l.weber@example.com')).toBeInTheDocument()
    await userEvent.click(page.getByRole('button', { name: 'Schließen' }))
    await waitFor(() => expect(page.queryByRole('dialog', { name: 'Patientenprofil' })).not.toBeInTheDocument())
  },
}

export const MessagesPatientProfileOpen: Story = {
  render: () => <MessagesHarness profileInitiallyOpen />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await expect(page.getByRole('dialog', { name: 'Patientenprofil' })).toBeInTheDocument()
    await expect(page.getByText('32 Jahre')).toBeInTheDocument()
    await expect(page.getByText(/Patient klagt über Haarausfall/)).toBeInTheDocument()
  },
}

export const ReviewsManagement: Story = {
  render: () => (
    <ClinicReviewsManagement data={reviewsManagementFixture} onAction={noAction} shell={clinicDashboardShellFixture} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Bewertungen', level: 1 })).toBeInTheDocument()
    await expect(canvas.getByText('Basiert auf 1,248 Bewertungen')).toBeInTheDocument()
    await expect(canvas.getByText('Beantwortet')).toBeInTheDocument()
    await expect(canvas.getByText('Offen')).toBeInTheDocument()
    await expect(canvas.getByText('In Prüfung')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Antworten gesperrt' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page')
  },
}

export const ClinicProfileEdit: Story = {
  render: () => (
    <ClinicProfileEditor data={clinicProfileFixture} onAction={noAction} shell={clinicDashboardShellFixture} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Klinikprofil bearbeiten', level: 1 })).toBeInTheDocument()
    await expect(canvas.getByLabelText('Klinikname')).toHaveValue('Berlin Health Dental & Derm Clinic')
    await expect(canvas.getByText('Dr. Markus Weber')).toBeInTheDocument()
    await expect(canvas.getAllByText('Zahnaufhellung (Laser)').length).toBeGreaterThanOrEqual(1)
    await expect(canvas.getByText('Alle Änderungen werden lokal zwischengespeichert.')).toBeInTheDocument()
  },
}

export const NewTreatmentDialogOpen: Story = {
  render: () => <TreatmentDialogHarness />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await expect(page.getByRole('dialog', { name: 'Neue Behandlung erstellen' })).toBeInTheDocument()
    await expect(page.getByLabelText('Behandlungsname')).toHaveAttribute('placeholder', 'z.B. Bleaching Express')
    await userEvent.click(page.getByRole('combobox', { name: 'Kategorie' }))
    await expect(page.getByRole('option', { name: 'Zahnmedizin' })).toBeInTheDocument()
    await userEvent.click(page.getByRole('option', { name: 'Zahnmedizin' }))
    await expect(page.getByRole('combobox', { name: 'Kategorie' })).toHaveTextContent('Zahnmedizin')
  },
}

export const AddTeamMemberDialogOpen: Story = {
  render: () => <TeamMemberDialogHarness />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    await expect(page.getByRole('dialog', { name: 'Teammitglied hinzufügen' })).toBeInTheDocument()
    await expect(page.getByLabelText('Vorname')).toHaveAttribute('placeholder', 'z.B. Dr. Michael')
    await expect(page.getByRole('button', { name: 'Profilbild auswählen' })).toBeInTheDocument()
    await expect(page.getByRole('button', { name: 'Hinzufügen' })).toBeInTheDocument()
  },
}

const TreatmentDialogInteractionBase: Story = {
  render: () => <TreatmentDialogHarness initiallyOpen={false} />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const trigger = page.getByRole('button', { name: 'Neue Behandlung' })
    await userEvent.click(trigger)
    await expect(page.getByRole('dialog', { name: 'Neue Behandlung erstellen' })).toBeInTheDocument()
    await userEvent.click(page.getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() =>
      expect(page.queryByRole('dialog', { name: 'Neue Behandlung erstellen' })).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(trigger).toHaveFocus())
    await userEvent.click(trigger)
    await expect(page.getByRole('dialog', { name: 'Neue Behandlung erstellen' })).toBeInTheDocument()
  },
}

const TeamMemberDialogInteractionBase: Story = {
  render: () => <TeamMemberDialogHarness initiallyOpen={false} />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const trigger = page.getByRole('button', { name: 'Teammitglied hinzufügen' })
    await userEvent.click(trigger)
    await expect(page.getByRole('dialog', { name: 'Teammitglied hinzufügen' })).toBeInTheDocument()
    await userEvent.type(page.getByLabelText('Vorname'), 'Anna')
    await userEvent.click(page.getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(page.queryByRole('dialog', { name: 'Teammitglied hinzufügen' })).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
    await userEvent.click(trigger)
    await expect(page.getByRole('dialog', { name: 'Teammitglied hinzufügen' })).toBeInTheDocument()
  },
}

const MobileNavigationBase: Story = {
  render: () => <DashboardHarness />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    const trigger = page.getByRole('button', { name: 'Navigation öffnen' })
    await userEvent.click(trigger)
    const dialog = page.getByRole('dialog', { name: 'Kliniknavigation' })
    await expect(dialog).toBeInTheDocument()
    await expect(within(dialog).getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Nachrichten' }))
    await waitFor(() => expect(page.queryByRole('dialog', { name: 'Kliniknavigation' })).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
    await userEvent.click(trigger)
    await expect(page.getByRole('dialog', { name: 'Kliniknavigation' })).toBeInTheDocument()
  },
}

export const MobileNavigationExpanded: Story = withViewportStory(
  MobileNavigationBase,
  'public320Short',
  'Mobile navigation expanded / 320 short',
)

export const NewTreatmentDialogShort320: Story = withViewportStory(
  TreatmentDialogInteractionBase,
  'public320Short',
  'New treatment dialog / 320 short',
)

export const NewTreatmentDialogShort375: Story = withViewportStory(
  TreatmentDialogInteractionBase,
  'public375Short',
  'New treatment dialog / 375 short',
)

export const AddTeamMemberDialogShort320: Story = withViewportStory(
  TeamMemberDialogInteractionBase,
  'public320Short',
  'Add team member dialog / 320 short',
)

export const AddTeamMemberDialogShort375: Story = withViewportStory(
  TeamMemberDialogInteractionBase,
  'public375Short',
  'Add team member dialog / 375 short',
)
