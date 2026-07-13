'use client'

import { Button } from '@/components/atoms/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/atoms/dialog'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/select'
import { Textarea } from '@/components/atoms/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/avatar'
import { Camera, Info, Mail, Phone } from 'lucide-react'
import { useId } from 'react'

import type { ClinicDashboardAction, PatientProfileData, TeamMemberDialogData, TreatmentDialogData } from './types'

type ControlledDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction?: (action: ClinicDashboardAction) => void
}

export function PatientProfileDialog({
  data,
  onOpenChange,
  open,
}: ControlledDialogProps & { data: PatientProfileData }) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] min-h-0 w-[calc(100%-2rem)] max-w-md gap-0 overflow-hidden p-0"
        overlayClassName="bg-backdrop/70 backdrop-blur-sm"
      >
        <DialogHeader className="border-b p-6 text-left">
          <DialogTitle>Patientenprofil</DialogTitle>
          <DialogDescription className="sr-only">Patientendaten zur ausgewählten Unterhaltung.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 overflow-y-auto p-6">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 border">
              <AvatarImage alt={data.avatar.alt} src={data.avatar.src} />
              <AvatarFallback>
                {data.name
                  .split(' ')
                  .map((part) => part[0])
                  .join('')}
              </AvatarFallback>
            </Avatar>
            <div className="text-lg font-bold">{data.name}</div>
          </div>
          <dl className="grid grid-cols-2 gap-5">
            {[
              ['Alter', data.age],
              ['Geschlecht', data.gender],
              ['Letzter Besuch', data.lastVisit],
              ['Interesse', data.interest],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-bold tracking-wide text-foreground/70 uppercase">{label}</dt>
                <dd className={label === 'Interesse' ? 'mt-1 font-bold text-primary' : 'mt-1 font-bold'}>{value}</dd>
              </div>
            ))}
          </dl>
          <section aria-labelledby="patient-contact-title" className="space-y-3">
            <div className="text-xs font-bold tracking-wide text-foreground/70 uppercase" id="patient-contact-title">
              Kontakt
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail aria-hidden="true" className="size-4 text-foreground/70" />
              <span>{data.contactEmail}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/70">
              <Phone aria-hidden="true" className="size-4" />
              <span className="sr-only">Telefonkontakt</span>
            </div>
          </section>
          <section aria-labelledby="patient-notes-title" className="space-y-2">
            <div className="text-xs font-bold tracking-wide text-foreground/70 uppercase" id="patient-notes-title">
              Medizinische Notizen
            </div>
            <p className="rounded-lg border bg-muted/60 p-4 text-sm leading-6">{data.medicalNotes}</p>
          </section>
        </div>
        <DialogFooter className="border-t bg-muted/60 p-5">
          <Button className="w-full sm:w-auto" onClick={() => onOpenChange(false)} variant="ghost">
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TreatmentDialog({
  data,
  onAction,
  onOpenChange,
  open,
}: ControlledDialogProps & { data: TreatmentDialogData }) {
  const id = useId()

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] min-h-0 w-[calc(100%-2rem)] max-w-xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0"
        overlayClassName="bg-backdrop/70 backdrop-blur-sm"
      >
        <DialogHeader className="border-b p-6 text-left">
          <DialogTitle>Neue Behandlung erstellen</DialogTitle>
          <DialogDescription className="sr-only">
            Neue Behandlung mit Kategorie, Dauer und Preis anlegen.
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault()
            onAction?.('save-treatment')
          }}
        >
          <div className="grid min-h-0 gap-5 overflow-y-auto overscroll-contain p-6">
            <div className="grid gap-2">
              <Label className="text-left" htmlFor={`${id}-name`}>
                Behandlungsname
              </Label>
              <Input id={`${id}-name`} placeholder={data.namePlaceholder} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-left" htmlFor={`${id}-category`}>
                  Kategorie
                </Label>
                <Select>
                  <SelectTrigger id={`${id}-category`}>
                    <SelectValue placeholder={data.categoryPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {data.categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-left" htmlFor={`${id}-duration`}>
                  Dauer (in Min)
                </Label>
                <Input id={`${id}-duration`} inputMode="numeric" placeholder={data.durationPlaceholder} />
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-left" htmlFor={`${id}-price`}>
                  Preis (in €)
                </Label>
                <Input id={`${id}-price`} inputMode="decimal" placeholder={data.pricePlaceholder} />
              </div>
              <div className="flex items-end gap-2 pb-2 text-sm text-foreground/70">
                <Info aria-hidden="true" className="size-4" />
                Preis inkl. MwSt.
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-left" htmlFor={`${id}-description`}>
                Beschreibung
              </Label>
              <Textarea id={`${id}-description`} placeholder={data.descriptionPlaceholder} rows={4} />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t bg-muted/60 p-5">
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Abbrechen
            </Button>
            <Button type="submit" variant="primary">
              Behandlung speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TeamMemberDialog({
  data,
  onAction,
  onOpenChange,
  open,
}: ControlledDialogProps & { data: TeamMemberDialogData }) {
  const id = useId()

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] min-h-0 w-[calc(100%-2rem)] max-w-xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0"
        overlayClassName="bg-backdrop/70 backdrop-blur-sm"
      >
        <DialogHeader className="border-b p-6 text-left">
          <DialogTitle>Teammitglied hinzufügen</DialogTitle>
          <DialogDescription className="sr-only">
            Profil und Rolle für ein neues Teammitglied erfassen.
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault()
            onAction?.('save-team-member')
          }}
        >
          <div className="grid min-h-0 gap-5 overflow-y-auto overscroll-contain p-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Button
                aria-label="Profilbild auswählen"
                className="size-24 shrink-0 flex-col gap-1 rounded-full border-2 border-dashed"
                onClick={() => onAction?.('choose-team-photo')}
                size="clear"
                type="button"
                variant="outline"
              >
                <Camera aria-hidden="true" className="size-7" />
                <span className="text-xs">Foto</span>
              </Button>
              <div>
                <div className="text-sm font-bold">Profilbild hochladen</div>
                <p className="mt-1 text-sm text-foreground/70">{data.uploadHint}</p>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-left" htmlFor={`${id}-first-name`}>
                  Vorname
                </Label>
                <Input id={`${id}-first-name`} placeholder={data.firstNamePlaceholder} />
              </div>
              <div className="grid gap-2">
                <Label className="text-left" htmlFor={`${id}-last-name`}>
                  Nachname
                </Label>
                <Input id={`${id}-last-name`} placeholder={data.lastNamePlaceholder} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-left" htmlFor={`${id}-role`}>
                Spezialisierung / Rolle
              </Label>
              <Select>
                <SelectTrigger id={`${id}-role`}>
                  <SelectValue placeholder={data.rolePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {data.roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-left" htmlFor={`${id}-biography`}>
                Kurze Biografie
              </Label>
              <Textarea id={`${id}-biography`} placeholder={data.biographyPlaceholder} rows={4} />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t bg-muted/60 p-5">
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Abbrechen
            </Button>
            <Button type="submit" variant="primary">
              Hinzufügen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
