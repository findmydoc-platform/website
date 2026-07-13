'use client'

import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardHeader } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Textarea } from '@/components/atoms/textarea'
import { cn } from '@/utilities/ui'
import { ChevronRight, GripHorizontal, MapPin, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react'
import Image from 'next/image'
import { useId } from 'react'

import { ClinicDashboardShell } from './ClinicDashboardShell'
import type {
  ClinicDashboardAction,
  ClinicDashboardShellData,
  ClinicProfileData,
  ClinicProfileTreatment,
} from './types'

type ClinicProfileEditorProps = {
  data: ClinicProfileData
  mobileNavigationOpen?: boolean
  onAction?: (action: ClinicDashboardAction) => void
  onMobileNavigationOpenChange?: (open: boolean) => void
  shell: ClinicDashboardShellData
}

function ProfileGallery({ data, onAction }: Pick<ClinicProfileEditorProps, 'data' | 'onAction'>) {
  return (
    <section
      aria-label="Klinikbilder"
      className="grid h-[22rem] grid-cols-2 grid-rows-3 gap-2 overflow-hidden rounded-xl sm:grid-cols-4 sm:grid-rows-2 lg:h-[25rem]"
    >
      {data.gallery.map((image, index) => (
        <div
          className={cn(
            'group relative overflow-hidden bg-muted',
            index === 0 ? 'col-span-2 row-span-2' : index === 3 ? 'col-span-2' : '',
          )}
          key={image.src}
        >
          <Image
            alt={image.alt}
            className="h-full w-full object-cover"
            fill
            loading="eager"
            priority={index === 0}
            sizes={index === 0 ? '(min-width: 640px) 50vw, 100vw' : '50vw'}
            src={image.src}
          />
          <Button
            aria-label={`${image.alt} ändern`}
            className="absolute top-3 left-3 gap-2 bg-card/90 opacity-100 shadow-sm sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
            onClick={() => onAction?.('change-gallery-image')}
            size="sm"
            variant="outline"
          >
            <Pencil aria-hidden="true" className="size-4" /> {index === 0 ? 'Bild ändern' : 'Bearbeiten'}
          </Button>
          {index === data.gallery.length - 1 ? (
            <span className="absolute right-3 bottom-3 rounded-lg bg-card/90 px-3 py-2 text-xs font-bold shadow-sm">
              + 12 weitere Bilder
            </span>
          ) : null}
        </div>
      ))}
    </section>
  )
}

function ClinicInfoCard({ data, onAction }: Pick<ClinicProfileEditorProps, 'data' | 'onAction'>) {
  const id = useId()
  const nameId = `${id}-name`
  const descriptionId = `${id}-description`

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="grid gap-2">
          <Label className="text-left text-xs tracking-wide text-foreground/70 uppercase" htmlFor={nameId}>
            Klinikname
          </Label>
          <Input className="text-lg font-bold" defaultValue={data.clinicName} id={nameId} />
        </div>
        <div className="grid gap-2">
          <Label className="text-left text-xs tracking-wide text-foreground/70 uppercase" htmlFor={descriptionId}>
            Beschreibung
          </Label>
          <Textarea defaultValue={data.clinicDescription} id={descriptionId} rows={6} />
        </div>
        <div>
          <div className="mb-2 text-xs font-bold tracking-wide text-foreground/70 uppercase">Spezialisierung</div>
          <div className="flex flex-wrap gap-2">
            {data.specialties.map((specialty) => (
              <span
                className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                key={specialty}
              >
                {specialty}
                <Button
                  aria-label={`${specialty} entfernen`}
                  className="size-5 rounded-full p-0"
                  onClick={() => onAction?.('remove-specialty')}
                  size="clear"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="size-3" />
                </Button>
              </span>
            ))}
            <Button
              className="gap-2 rounded-full border-dashed"
              onClick={() => onAction?.('add-specialty')}
              size="sm"
              variant="outline"
            >
              <Plus aria-hidden="true" className="size-4" /> Hinzufügen
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TeamCard({ data, onAction }: Pick<ClinicProfileEditorProps, 'data' | 'onAction'>) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b p-5">
        <Heading align="left" as="h2" className="text-xl" size="h5">
          Ärzte &amp; Team
        </Heading>
        <Button className="gap-2" onClick={() => onAction?.('add-team-member')} size="sm" variant="link">
          <UserPlus aria-hidden="true" className="size-4" /> Mitglied hinzufügen
        </Button>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {data.team.map((member) => (
          <div className="flex items-center gap-4 p-5" key={member.id}>
            <Image
              alt={member.avatar.alt}
              className="size-16 rounded-full object-cover"
              height={64}
              src={member.avatar.src}
              width={64}
            />
            <div className="min-w-0 flex-1">
              <div className="font-bold">{member.name}</div>
              <p className="mt-1 text-sm text-foreground/70">{member.specialty}</p>
            </div>
            <div className="flex gap-1">
              <Button
                aria-label={`${member.name} bearbeiten`}
                onClick={() => onAction?.('edit-team-member')}
                size="icon"
                variant="ghost"
              >
                <Pencil aria-hidden="true" className="size-4" />
              </Button>
              <Button
                aria-label={`${member.name} entfernen`}
                onClick={() => onAction?.('remove-team-member')}
                size="icon"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function TreatmentCardMobile({
  treatment,
  onAction,
}: {
  onAction?: (action: ClinicDashboardAction) => void
  treatment: ClinicProfileTreatment
}) {
  return (
    <div className="rounded-lg border p-4 sm:hidden">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="col-span-2">
          <dt className="text-xs font-bold text-foreground/70 uppercase">Behandlung</dt>
          <dd className="mt-1 font-bold">{treatment.name}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-foreground/70 uppercase">Dauer</dt>
          <dd className="mt-1">{treatment.duration}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-foreground/70 uppercase">Preis ab</dt>
          <dd className="mt-1 font-bold text-primary">{treatment.price}</dd>
        </div>
      </dl>
      <Button className="mt-3 w-full gap-2" onClick={() => onAction?.('reorder-treatment')} size="sm" variant="ghost">
        <GripHorizontal aria-hidden="true" className="size-4" /> Reihenfolge ändern
      </Button>
    </div>
  )
}

function TreatmentsCard({ data, onAction }: Pick<ClinicProfileEditorProps, 'data' | 'onAction'>) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b p-5">
        <Heading align="left" as="h2" className="text-xl" size="h5">
          Behandlungen &amp; Preise
        </Heading>
        <Button className="gap-2" onClick={() => onAction?.('add-treatment')} size="sm" variant="link">
          <Plus aria-hidden="true" className="size-4" /> Neue Behandlung
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        <table className="hidden w-full text-left text-sm sm:table">
          <caption className="sr-only">Behandlungen und Preise der Klinik</caption>
          <thead className="bg-muted/70 text-xs text-foreground/70 uppercase">
            <tr>
              <th className="px-4 py-3" scope="col">
                Behandlung
              </th>
              <th className="px-4 py-3" scope="col">
                Dauer
              </th>
              <th className="px-4 py-3" scope="col">
                Preis ab
              </th>
              <th className="px-4 py-3" scope="col">
                <span className="sr-only">Aktionen</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.treatments.map((treatment) => (
              <tr key={treatment.id}>
                <th className="px-4 py-4 font-medium" scope="row">
                  {treatment.name}
                </th>
                <td className="px-4 py-4 text-foreground/70">{treatment.duration}</td>
                <td className="px-4 py-4 font-bold text-primary">{treatment.price}</td>
                <td className="px-4 py-4 text-right">
                  <Button
                    aria-label={`${treatment.name} verschieben`}
                    onClick={() => onAction?.('reorder-treatment')}
                    size="icon"
                    variant="ghost"
                  >
                    <GripHorizontal aria-hidden="true" className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.treatments.map((treatment) => (
          <TreatmentCardMobile key={treatment.id} onAction={onAction} treatment={treatment} />
        ))}
      </CardContent>
    </Card>
  )
}

function ContactCard({ data, onAction }: Pick<ClinicProfileEditorProps, 'data' | 'onAction'>) {
  const id = useId()
  const streetId = `${id}-street`
  const cityId = `${id}-city`
  const postalCodeId = `${id}-postal-code`
  const phoneId = `${id}-phone`

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b p-5">
        <Heading align="left" as="h2" className="text-xl" size="h5">
          Standort &amp; Kontakt
        </Heading>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid gap-4 p-5">
          <div className="grid gap-2">
            <Label className="text-left text-xs text-foreground/70 uppercase" htmlFor={streetId}>
              Straße &amp; Hausnummer
            </Label>
            <Input defaultValue={data.address.street} id={streetId} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 grid gap-2">
              <Label className="text-left text-xs text-foreground/70 uppercase" htmlFor={cityId}>
                Stadt
              </Label>
              <Input defaultValue={data.address.city} id={cityId} />
            </div>
            <div className="grid gap-2">
              <Label className="text-left text-xs text-foreground/70 uppercase" htmlFor={postalCodeId}>
                PLZ
              </Label>
              <Input defaultValue={data.address.postalCode} id={postalCodeId} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label className="text-left text-xs text-foreground/70 uppercase" htmlFor={phoneId}>
              Telefon
            </Label>
            <Input defaultValue={data.address.phone} id={phoneId} />
          </div>
        </div>
        <div className="relative h-48 border-t bg-muted">
          <Image
            alt="Kartenvorschau der Klinikadresse in Berlin"
            className="object-cover opacity-75"
            fill
            sizes="(min-width: 1280px) 25vw, 100vw"
            src="/images/clinic-detail/clinic-location-map-placeholder.svg"
          />
          <Button
            className="absolute right-4 bottom-4 gap-2 shadow-md"
            onClick={() => onAction?.('edit-map')}
            size="sm"
            variant="primary"
          >
            <MapPin aria-hidden="true" className="size-4" /> Karte anpassen
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function OpeningHoursCard({ data, onAction }: Pick<ClinicProfileEditorProps, 'data' | 'onAction'>) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 p-5">
        <Heading align="left" as="h2" className="text-xl" size="h5">
          Öffnungszeiten
        </Heading>
        <Button className="h-auto p-0" onClick={() => onAction?.('edit-opening-hours')} size="clear" variant="link">
          Bearbeiten
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5">
        {data.openingHours.map((entry) => (
          <div className="flex justify-between gap-3 text-sm" key={entry.days}>
            <span className="text-foreground/70">{entry.days}</span>
            <span className={cn('font-bold', entry.closed && 'text-secondary italic')}>{entry.hours}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ProfileActionBar({ data, onAction }: Pick<ClinicProfileEditorProps, 'data' | 'onAction'>) {
  return (
    <div className="mt-6 flex flex-col gap-4 border bg-card/95 p-4 shadow-lg backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between md:fixed md:right-0 md:bottom-0 md:left-20 md:z-30 md:mt-0 lg:left-64">
      <div className="flex items-center gap-3 text-sm text-foreground/70">
        <span aria-hidden="true" className="size-3 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
        {data.autosaveMessage}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => onAction?.('discard-profile-changes')} variant="outline">
          Verwerfen
        </Button>
        <Button onClick={() => onAction?.('publish-profile-changes')} variant="primary">
          Änderungen publizieren
        </Button>
      </div>
    </div>
  )
}

export function ClinicProfileEditor({
  data,
  mobileNavigationOpen,
  onAction,
  onMobileNavigationOpenChange,
  shell,
}: ClinicProfileEditorProps) {
  const headerActions = (
    <>
      <Button onClick={() => onAction?.('cancel-profile-edit')} size="sm" variant="outline">
        Abbrechen
      </Button>
      <Button onClick={() => onAction?.('save-profile')} size="sm" variant="primary">
        Änderungen speichern
      </Button>
    </>
  )

  return (
    <ClinicDashboardShell
      activeSection="profile"
      contentClassName="md:pb-28"
      data={shell}
      headerActions={headerActions}
      mobileNavigationOpen={mobileNavigationOpen}
      onAction={onAction}
      onMobileNavigationOpenChange={onMobileNavigationOpenChange}
    >
      <div className="space-y-6">
        <header>
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-2 text-sm text-foreground/70">
            {data.breadcrumbs.map((breadcrumb, index) => (
              <span className="flex items-center gap-2" key={breadcrumb}>
                {index > 0 ? <ChevronRight aria-hidden="true" className="size-4" /> : null}
                {breadcrumb}
              </span>
            ))}
          </nav>
          <Heading align="left" as="h1" className="text-3xl sm:text-4xl" size="h2">
            Klinikprofil bearbeiten
          </Heading>
        </header>
        <ProfileGallery data={data} onAction={onAction} />
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <ClinicInfoCard data={data} onAction={onAction} />
            <TeamCard data={data} onAction={onAction} />
            <TreatmentsCard data={data} onAction={onAction} />
          </div>
          <div className="space-y-6 xl:col-span-4">
            <ContactCard data={data} onAction={onAction} />
            <OpeningHoursCard data={data} onAction={onAction} />
          </div>
        </div>
        <ProfileActionBar data={data} onAction={onAction} />
      </div>
    </ClinicDashboardShell>
  )
}
