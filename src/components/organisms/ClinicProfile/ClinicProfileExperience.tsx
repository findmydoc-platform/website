'use client'

import * as React from 'react'
import { ArrowRight, Check, ChevronRight, Globe2, Search, ShieldCheck, Stethoscope } from 'lucide-react'
import { Button } from '@/components/atoms/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/atoms/dialog'
import { Heading } from '@/components/atoms/Heading'
import { Media } from '@/components/molecules/Media'
import type { ClinicDetailDoctor, ClinicDetailTreatment } from '@/features/clinicDetail/contracts'
import { ClinicProfile, type ClinicProfileProps } from './ClinicProfile'

export type ClinicProfileBrowseActions = {
  showTreatments: () => void
  showDoctors: () => void
  showReviews: () => void
}
type InquirySlot = React.ReactNode | ((actions: ClinicProfileBrowseActions) => React.ReactNode)

export type ClinicProfileExperienceProps = Omit<
  ClinicProfileProps,
  'navigation' | 'children' | 'inquiryAside' | 'afterLocation' | 'showDescription'
> & {
  inquiryAside?: InquirySlot
  afterLocation?: InquirySlot
  overviewReviews?: InquirySlot
  selectedDoctorId: string | null
  selectedTreatmentId: string | null
  onDoctorChange: (id: string | null) => void
  onTreatmentChange: (id: string | null) => void
  reviews?: React.ReactNode
}

type Tab = 'overview' | 'treatments' | 'reviews' | 'doctors'
type Detail = { type: 'doctor' | 'treatment'; id: string } | { type: 'about' | 'information' } | null
const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'treatments', label: 'Treatments' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'doctors', label: 'Doctors' },
]
const treatmentCategory = (item: ClinicDetailTreatment | ClinicDetailDoctor | undefined) =>
  item && 'category' in item ? item.category : undefined
const visibleSpecialty = (specialty: string) => (specialty === 'General Practice' ? '' : specialty)
const money = (value: number) =>
  new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value)

export function ClinicProfileExperience({
  data,
  selectedDoctorId,
  selectedTreatmentId,
  onDoctorChange,
  onTreatmentChange,
  reviews,
  overviewReviews,
  inquiryAside,
  afterLocation,
  ...profile
}: ClinicProfileExperienceProps) {
  const [active, setActive] = React.useState<Tab>('overview')
  const [detail, setDetail] = React.useState<Detail>(null)
  const trigger = React.useRef<HTMLElement | null>(null)
  const tabRefs = React.useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})
  const tabListRef = React.useRef<HTMLDivElement>(null)
  const id = React.useId()
  const openDetail = (type: 'doctor' | 'treatment', itemId: string, element: HTMLElement) => {
    trigger.current = element
    setDetail({ type, id: itemId })
  }
  const openInformation = (event: React.MouseEvent<HTMLButtonElement>) => {
    trigger.current = event.currentTarget
    setDetail({ type: 'information' })
  }
  const showTab = (tab: Tab) => {
    setActive(tab)
    tabRefs.current[tab]?.focus()
  }
  const doctor = detail?.type === 'doctor' ? data.doctors.find((item) => item.id === detail.id) : undefined
  const treatment = detail?.type === 'treatment' ? data.treatments.find((item) => item.id === detail.id) : undefined
  const previewTreatments = [...data.treatments].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 4)
  const browseActions: ClinicProfileBrowseActions = {
    showTreatments: () => showTab('treatments'),
    showDoctors: () => showTab('doctors'),
    showReviews: () => showTab('reviews'),
  }
  const navigation = (
    <div className="relative mt-7 border-b border-border">
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Clinic information"
        className="flex [scrollbar-width:none] overflow-x-auto pr-8 sm:pr-0 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab, index) => {
          const count =
            tab.id === 'treatments'
              ? data.treatments.length
              : tab.id === 'doctors'
                ? data.doctors.length
                : tab.id === 'reviews'
                  ? data.reviews.totalCount
                  : 0
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node
              }}
              id={`${id}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={active === tab.id}
              aria-controls={`${id}-panel-${tab.id}`}
              tabIndex={active === tab.id ? 0 : -1}
              className={`min-h-12 shrink-0 border-b-2 px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary sm:px-5 ${active === tab.id ? 'border-secondary font-semibold text-secondary' : 'border-transparent text-muted-foreground'}`}
              onClick={() => setActive(tab.id)}
              onKeyDown={(event) => {
                const next =
                  event.key === 'ArrowRight'
                    ? (index + 1) % tabs.length
                    : event.key === 'ArrowLeft'
                      ? (index + tabs.length - 1) % tabs.length
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? tabs.length - 1
                          : -1
                if (next >= 0) {
                  event.preventDefault()
                  showTab(tabs[next]!.id)
                }
              }}
            >
              {tab.label}
              {count > 0 ? ' ' : null}
              {count > 0 ? (
                <span className="ml-1 rounded bg-muted px-1 text-[10px] sm:ml-2 sm:text-xs">{count}</span>
              ) : null}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        aria-label="Show later tabs"
        className="absolute inset-y-0 right-0 flex w-8 items-center justify-center bg-background text-secondary sm:hidden"
        onClick={() => tabListRef.current?.scrollBy({ left: 180, behavior: 'smooth' })}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
  return (
    <>
      <ClinicProfile
        {...profile}
        data={data}
        showDescription={false}
        onReviewsClick={() => showTab('reviews')}
        navigation={navigation}
        inquiryAside={typeof inquiryAside === 'function' ? inquiryAside(browseActions) : inquiryAside}
        afterLocation={typeof afterLocation === 'function' ? afterLocation(browseActions) : afterLocation}
      >
        {tabs.map((tab) => (
          <section
            key={tab.id}
            role="tabpanel"
            id={`${id}-panel-${tab.id}`}
            aria-labelledby={`${id}-tab-${tab.id}`}
            hidden={active !== tab.id}
            tabIndex={0}
          >
            {tab.id === 'overview' ? (
              <div className="space-y-12">
                {data.description ? (
                  <section>
                    <Heading as="h2" size="h4" align="left" className="text-secondary">
                      About {data.clinicName}
                    </Heading>
                    <p className="mt-4 leading-7 text-muted-foreground">{data.description}</p>
                    <Button
                      type="button"
                      variant="link"
                      className="mt-4 min-h-11 p-0"
                      onClick={(event) => {
                        trigger.current = event.currentTarget
                        setDetail({ type: 'about' })
                      }}
                    >
                      Get to know the clinic <ArrowRight aria-hidden="true" />
                    </Button>
                  </section>
                ) : null}
                {previewTreatments.length ? (
                  <section className="border-t border-border pt-10">
                    <p className="text-xs font-semibold tracking-widest text-primary uppercase">Find your next step</p>
                    <Heading as="h2" size="h4" align="left" className="mt-3 text-secondary">
                      Treatments
                    </Heading>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      {previewTreatments.map((item) => (
                        <TreatmentPreview
                          key={item.id}
                          item={item}
                          selected={selectedTreatmentId === item.id}
                          onOpen={(element) => openDetail('treatment', item.id, element)}
                        />
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-5 min-h-11"
                      onClick={() => showTab('treatments')}
                    >
                      View all treatments <ArrowRight aria-hidden="true" />
                    </Button>
                  </section>
                ) : null}
                {typeof overviewReviews === 'function' ? overviewReviews(browseActions) : overviewReviews}
                {data.doctors.length ? (
                  <section className="border-t border-border pt-10">
                    <p className="text-xs font-semibold tracking-widest text-primary uppercase">
                      The people behind your care
                    </p>
                    <Heading as="h2" size="h4" align="left" className="mt-3 text-secondary">
                      Our doctors
                    </Heading>
                    <div className="mt-5 grid gap-4">
                      {data.doctors.slice(0, 3).map((item) => (
                        <DoctorCard
                          key={item.id}
                          item={item}
                          selected={selectedDoctorId === item.id}
                          onOpen={(element) => openDetail('doctor', item.id, element)}
                          onSelect={() => onDoctorChange(item.id)}
                        />
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-5 min-h-11"
                      onClick={() => showTab('doctors')}
                    >
                      Meet all doctors <ArrowRight aria-hidden="true" />
                    </Button>
                  </section>
                ) : null}
                {data.trust.languages.length ||
                data.trust.verification !== 'unverified' ||
                data.trust.accreditations.length ? (
                  <section className="border-t border-border pt-10">
                    <p className="text-xs font-semibold tracking-widest text-primary uppercase">
                      The practical details
                    </p>
                    <Heading as="h2" size="h4" align="left" className="mt-3 text-secondary">
                      More about the clinic
                    </Heading>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                      The information that helps you prepare, whenever you need it.
                    </p>
                    <div className="mt-6 grid gap-x-7 sm:grid-cols-2">
                      {data.trust.languages.length ? (
                        <button
                          type="button"
                          className="flex min-h-20 w-full items-center gap-3 border-b border-border text-left"
                          onClick={openInformation}
                        >
                          <Globe2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <strong className="block text-sm">Languages</strong>
                            <span className="text-xs text-muted-foreground">{data.trust.languages.join(', ')}</span>
                          </span>
                          <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                        </button>
                      ) : null}
                      {data.trust.verification !== 'unverified' ? (
                        <button
                          type="button"
                          className="flex min-h-20 w-full items-center gap-3 border-b border-border text-left"
                          onClick={openInformation}
                        >
                          <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <strong className="block text-sm">Verification</strong>
                            <span className="text-xs text-muted-foreground capitalize">{data.trust.verification}</span>
                          </span>
                          <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                    <Button type="button" variant="link" className="mt-5 min-h-11 p-0" onClick={openInformation}>
                      All clinic information <ArrowRight aria-hidden="true" />
                    </Button>
                  </section>
                ) : null}
              </div>
            ) : null}
            {tab.id === 'treatments' && active === tab.id ? (
              <Directory
                type="treatments"
                items={data.treatments}
                selectedId={selectedTreatmentId}
                onSelect={onTreatmentChange}
                onOpen={(itemId, element) => openDetail('treatment', itemId, element)}
              />
            ) : null}
            {tab.id === 'doctors' && active === tab.id ? (
              <Directory
                type="doctors"
                items={data.doctors}
                selectedId={selectedDoctorId}
                onSelect={onDoctorChange}
                onOpen={(itemId, element) => openDetail('doctor', itemId, element)}
              />
            ) : null}
            {tab.id === 'reviews' ? reviews : null}
          </section>
        ))}
      </ClinicProfile>
      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
      >
        <DialogContent
          className="fixed top-0 right-0 left-auto flex h-dvh max-h-dvh w-full max-w-xl translate-x-0 translate-y-0 flex-col overflow-y-auto rounded-none p-6 sm:p-10"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (trigger.current?.isConnected) trigger.current.focus()
            else tabRefs.current[active]?.focus()
          }}
        >
          <DialogTitle className="pr-12 text-2xl">
            {doctor?.name || treatment?.name || `About ${data.clinicName}`}
          </DialogTitle>
          <DialogDescription>Information supplied on this clinic profile.</DialogDescription>
          {detail?.type === 'about' ? <p className="leading-7">{data.description}</p> : null}
          {detail?.type === 'information' ? (
            <div className="space-y-3 text-sm">
              <p>Verification is a findmydoc profile status. Accreditations are listed separately.</p>
              <p>
                Verification:{' '}
                <span className="capitalize">
                  {data.trust.verification === 'unverified' ? 'Not verified' : data.trust.verification}
                </span>
              </p>
              {data.trust.accreditations.length ? <p>Accreditations: {data.trust.accreditations.join(', ')}</p> : null}
              {data.trust.languages.length ? <p>Languages: {data.trust.languages.join(', ')}</p> : null}
            </div>
          ) : null}
          {treatment ? (
            <div className="space-y-4">
              {treatment.category ? <p>{treatment.category}</p> : null}
              {treatment.priceFrom != null ? <p className="font-semibold">From {money(treatment.priceFrom)}</p> : null}
              <Button
                type="button"
                onClick={() => onTreatmentChange(treatment.id)}
                aria-pressed={selectedTreatmentId === treatment.id}
              >
                {selectedTreatmentId === treatment.id ? 'Selected for your inquiry' : 'Choose for inquiry'}
              </Button>
            </div>
          ) : null}
          {doctor ? (
            <div className="space-y-4">
              {visibleSpecialty(doctor.specialty) ? <p>{visibleSpecialty(doctor.specialty)}</p> : null}
              {doctor.description ? <p className="leading-7">{doctor.description}</p> : null}
              {doctor.qualifications?.length ? <p>{doctor.qualifications.join(' · ')}</p> : null}
              {doctor.yearsExperience != null ? <p>{doctor.yearsExperience} years of experience</p> : null}
              {doctor.languages?.length ? <p>{doctor.languages.join(' · ')}</p> : null}
              <Button
                type="button"
                onClick={() => onDoctorChange(doctor.id)}
                aria-pressed={selectedDoctorId === doctor.id}
              >
                {selectedDoctorId === doctor.id ? 'Selected for your inquiry' : 'Choose for inquiry'}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function TreatmentPreview({
  item,
  selected,
  onOpen,
}: {
  item: ClinicDetailTreatment
  selected: boolean
  onOpen: (element: HTMLElement) => void
}) {
  return (
    <article>
      <Button
        type="button"
        variant="outline"
        className="flex h-full min-h-48 w-full flex-col items-start justify-between gap-3 rounded-2xl border-transparent bg-card p-4 text-left whitespace-normal shadow-sm sm:p-6"
        onClick={(event) => onOpen(event.currentTarget)}
      >
        <span className="flex size-11 items-center justify-center rounded-full border border-primary/30 text-primary">
          <Stethoscope className="size-5" aria-hidden="true" />
        </span>
        {item.category ? <span className="text-xs text-muted-foreground">{item.category}</span> : null}
        <span className="max-w-full text-lg font-semibold [overflow-wrap:anywhere]">{item.name}</span>
        {selected ? <span className="text-xs text-primary">Selected for your inquiry</span> : null}
        <span className="flex w-full items-center justify-between">
          {item.priceFrom != null ? <span>From {money(item.priceFrom)}</span> : <span />}
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        </span>
      </Button>
    </article>
  )
}

function DoctorCard({
  item,
  selected,
  onOpen,
  onSelect,
}: {
  item: ClinicDetailDoctor
  selected: boolean
  onOpen: (element: HTMLElement) => void
  onSelect: () => void
}) {
  return (
    <article
      className={`rounded-2xl border p-5 ${selected ? 'border-primary bg-primary/5' : 'border-transparent bg-card shadow-sm'}`}
    >
      <div className="flex gap-4">
        <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl sm:h-36 sm:w-32">
          <Media htmlElement={null} src={item.image.src} alt="" fill imgClassName="object-cover" size="128px" />
        </div>
        <div className="min-w-0">
          <Heading as="h3" size="h5" align="left" className="break-words">
            {item.name}
          </Heading>
          {visibleSpecialty(item.specialty) ? (
            <p className="mt-1 text-sm text-muted-foreground">{visibleSpecialty(item.specialty)}</p>
          ) : null}
          {item.qualifications?.length || item.yearsExperience != null ? (
            <p className="mt-2 text-sm">
              {[item.qualifications?.join(', '), item.yearsExperience != null ? `${item.yearsExperience} years` : '']
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
          {item.languages?.length ? (
            <p className="mt-1 text-sm text-muted-foreground">{item.languages.join(' · ')}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4">
        <Button
          type="button"
          variant="link"
          className="min-h-11 p-0"
          aria-label={`View profile for ${item.name}`}
          onClick={(event) => onOpen(event.currentTarget)}
        >
          View profile <ArrowRight aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 px-2"
          aria-label={selected ? `${item.name}, selected for your inquiry` : `Choose ${item.name} for inquiry`}
          aria-pressed={selected}
          onClick={onSelect}
        >
          {selected ? (
            <>
              <Check aria-hidden="true" />
              Selected for your inquiry
            </>
          ) : (
            'Choose for inquiry'
          )}
        </Button>
      </div>
    </article>
  )
}

type DirectoryProps = {
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpen: (id: string, element: HTMLElement) => void
} & ({ type: 'treatments'; items: ClinicDetailTreatment[] } | { type: 'doctors'; items: ClinicDetailDoctor[] })
function Directory(props: DirectoryProps) {
  const [query, setQuery] = React.useState('')
  const [category, setCategory] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const resultsRef = React.useRef<HTMLParagraphElement>(null)
  const { type, items, selectedId, onSelect, onOpen } = props
  const categories = [
    ...new Set(
      items
        .map((item) => ('specialty' in item ? visibleSpecialty(item.specialty) : item.category || ''))
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b))
  const filtered = items.filter((item) => {
    const field = 'specialty' in item ? visibleSpecialty(item.specialty) : item.category || ''
    const languages = 'languages' in item ? item.languages?.join(' ') || '' : ''
    return (
      (category === 'all' || category === field) &&
      `${item.name} ${field} ${languages}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    )
  })
  const pages = Math.ceil(filtered.length / 6)
  const shown = filtered.slice((page - 1) * 6, page * 6)
  const label = type === 'doctors' ? 'Doctors' : 'Treatments'
  const reset = () => {
    setQuery('')
    setCategory('all')
    setPage(1)
    searchRef.current?.focus()
  }
  return (
    <div>
      <Heading as="h2" size="h3" align="left" className="text-secondary">
        {label}
      </Heading>
      {!items.length ? (
        <p className="mt-6 text-muted-foreground">
          {type === 'doctors'
            ? 'Doctor profiles have not been added to this profile yet.'
            : 'Treatment information has not been added to this profile.'}
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-3.5 left-4 size-5 text-muted-foreground"
              />
              <span className="sr-only">
                {type === 'doctors' ? 'Search name, specialty or language' : 'Search treatments'}
              </span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                placeholder={type === 'doctors' ? 'Search name, specialty or language' : 'Search treatments'}
                className="min-h-12 w-full rounded-full border border-input bg-transparent pr-4 pl-12 outline-primary"
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
              />
            </label>
            <label>
              <span className="sr-only">Filter by specialty</span>
              <select
                value={category}
                className="min-h-12 w-full rounded-full border border-input bg-transparent px-4 sm:w-auto"
                onChange={(event) => {
                  setCategory(event.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All specialties</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p ref={resultsRef} tabIndex={-1} role="status" className="mt-4 text-sm text-muted-foreground">
            {filtered.length
              ? `${(page - 1) * 6 + 1}–${Math.min(page * 6, filtered.length)} of ${filtered.length}`
              : '0'}{' '}
            {label.toLowerCase()}
          </p>
          {shown.length ? (
            <div className={type === 'doctors' ? 'mt-6 grid gap-4 sm:grid-cols-2' : 'mt-4'}>
              {shown.map((item, index) =>
                'specialty' in item ? (
                  <DoctorCard
                    key={item.id}
                    item={item}
                    selected={selectedId === item.id}
                    onOpen={(element) => onOpen(item.id, element)}
                    onSelect={() => onSelect(item.id)}
                  />
                ) : (
                  <React.Fragment key={item.id}>
                    {item.category && (index === 0 || treatmentCategory(shown[index - 1]) !== item.category) ? (
                      <Heading as="h3" size="h6" align="left" className="mt-6 text-sm text-muted-foreground">
                        {item.category}
                      </Heading>
                    ) : null}
                    <article className={`border-b border-border py-5 ${selectedId === item.id ? 'bg-primary/5' : ''}`}>
                      <div className="flex flex-wrap justify-between gap-3">
                        <div className="min-w-0">
                          <Heading
                            as={item.category ? 'h4' : 'h3'}
                            size="h5"
                            align="left"
                            className="mt-1 break-words text-secondary"
                          >
                            {item.name}
                          </Heading>
                        </div>
                        {item.priceFrom != null ? <strong>From {money(item.priceFrom)}</strong> : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4">
                        <Button
                          type="button"
                          variant="link"
                          className="min-h-11 p-0"
                          aria-label={`Treatment details for ${item.name}`}
                          onClick={(event) => onOpen(item.id, event.currentTarget)}
                        >
                          Treatment details <ArrowRight aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-11 px-2"
                          aria-label={
                            selectedId === item.id
                              ? `${item.name}, selected for your inquiry`
                              : `Select ${item.name} for inquiry`
                          }
                          aria-pressed={selectedId === item.id}
                          onClick={() => onSelect(item.id)}
                        >
                          {selectedId === item.id ? (
                            <>
                              <Check aria-hidden="true" />
                              Selected
                            </>
                          ) : (
                            'Select treatment'
                          )}
                        </Button>
                      </div>
                    </article>
                  </React.Fragment>
                ),
              )}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p>No {label.toLowerCase()} match your search and filters.</p>
              <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={reset}>
                Reset filters
              </Button>
            </div>
          )}
          {pages > 1 ? (
            <nav aria-label={`${label} pages`} className="mt-6 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={page === 1}
                onClick={() => {
                  setPage(page - 1)
                  requestAnimationFrame(() => resultsRef.current?.focus())
                }}
              >
                Previous
              </Button>
              <span className="px-2 text-sm">
                {page} / {pages}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={page === pages}
                onClick={() => {
                  setPage(page + 1)
                  requestAnimationFrame(() => resultsRef.current?.focus())
                }}
              >
                Next
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  )
}
