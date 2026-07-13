'use client'

import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardHeader } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { cn } from '@/utilities/ui'
import { Building2, Plus } from 'lucide-react'
import Image from 'next/image'
import type { Ref } from 'react'

import { ClinicDashboardShell } from './ClinicDashboardShell'
import type { ClinicDashboardAction, ClinicDashboardShellData, ClinicProfileDialogBackdropData } from './types'

type ClinicProfileDialogBackdropProps = {
  data: ClinicProfileDialogBackdropData
  dialogTriggerRef?: Ref<HTMLButtonElement>
  mobileNavigationOpen?: boolean
  onAction?: (action: ClinicDashboardAction) => void
  onMobileNavigationOpenChange?: (open: boolean) => void
  shell: ClinicDashboardShellData
}

function TreatmentCatalog({
  data,
  dialogTriggerRef,
  onAction,
}: {
  data: Extract<ClinicProfileDialogBackdropData, { variant: 'treatments' }>
  dialogTriggerRef?: Ref<HTMLButtonElement>
  onAction?: (action: ClinicDashboardAction) => void
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-8">
        <CardHeader className="items-start gap-3 space-y-0 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <Heading align="left" as="h2" className="text-xl" size="h5">
            {data.title}
          </Heading>
          <Button
            className="w-full gap-2 sm:w-auto"
            onClick={() => onAction?.('add-treatment')}
            ref={dialogTriggerRef}
            size="sm"
            variant="primary"
          >
            <Plus aria-hidden="true" className="size-4" /> Neue Behandlung
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {data.items.map((item) => (
            <div
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-background p-4"
              key={item.id}
            >
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-secondary/10 p-3 text-secondary">
                  <Building2 aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <div className="font-bold">{item.name}</div>
                  <div className="mt-1 text-sm text-foreground/70">
                    {item.category} • {item.duration}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-primary">{item.price}</div>
                <span className="mt-1 inline-block rounded-full bg-accent/25 px-2 py-1 text-[10px] font-bold text-accent-foreground uppercase">
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="lg:col-span-4">
        <CardHeader className="p-5">
          <Heading align="left" as="h2" className="text-xl" size="h5">
            Klinik Details
          </Heading>
        </CardHeader>
        <CardContent className="space-y-4 px-5 pb-5">
          <Image
            alt={data.clinicImage.alt}
            className="aspect-video w-full rounded-lg object-cover"
            height={240}
            loading="eager"
            priority
            src={data.clinicImage.src}
            width={420}
          />
          <Button className="w-full" onClick={() => onAction?.('edit-profile')} variant="secondary">
            Informationen bearbeiten
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function TeamSkeleton({
  data,
  dialogTriggerRef,
  onAction,
}: {
  data: Extract<ClinicProfileDialogBackdropData, { variant: 'team' }>
  dialogTriggerRef?: Ref<HTMLButtonElement>
  onAction?: (action: ClinicDashboardAction) => void
}) {
  return (
    <Card>
      <CardHeader className="items-start gap-3 space-y-0 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <Heading align="left" as="h2" className="text-xl" size="h5">
          {data.title}
        </Heading>
        <Button
          className="w-full gap-2 sm:w-auto"
          onClick={() => onAction?.('add-team-member')}
          ref={dialogTriggerRef}
          size="sm"
          variant="primary"
        >
          <Plus aria-hidden="true" className="size-4" /> Teammitglied hinzufügen
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: data.skeletonCount }, (_, index) => (
          <div
            aria-label={`Teamkarte ${index + 1} wird geladen`}
            className="h-48 animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
            key={index}
            role="status"
          />
        ))}
      </CardContent>
    </Card>
  )
}

export function ClinicProfileDialogBackdrop({
  data,
  dialogTriggerRef,
  mobileNavigationOpen,
  onAction,
  onMobileNavigationOpenChange,
  shell,
}: ClinicProfileDialogBackdropProps) {
  const treatmentView = data.variant === 'treatments'
  const headerActions = treatmentView ? null : (
    <Button onClick={() => onAction?.('save-profile')} size="sm" variant="primary">
      Speichern
    </Button>
  )

  return (
    <ClinicDashboardShell
      activeSection="profile"
      data={shell}
      headerActions={headerActions}
      mobileNavigationOpen={mobileNavigationOpen}
      onAction={onAction}
      onMobileNavigationOpenChange={onMobileNavigationOpenChange}
    >
      <div className={cn('space-y-6', !treatmentView && 'grayscale-[0.2]')}>
        <header>
          <Heading align="left" as="h1" className="text-3xl sm:text-4xl" size="h2">
            {treatmentView ? 'Klinikprofil' : data.title}
          </Heading>
          {treatmentView ? (
            <p className="mt-2 text-foreground/70">Verwalten Sie Ihre Klinikdetails und Dienstleistungen.</p>
          ) : null}
        </header>
        {data.variant === 'treatments' ? (
          <TreatmentCatalog data={data} dialogTriggerRef={dialogTriggerRef} onAction={onAction} />
        ) : (
          <TeamSkeleton data={data} dialogTriggerRef={dialogTriggerRef} onAction={onAction} />
        )}
      </div>
    </ClinicDashboardShell>
  )
}
