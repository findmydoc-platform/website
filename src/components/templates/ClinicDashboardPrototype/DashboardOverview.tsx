'use client'

import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardHeader } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/atoms/tabs'
import { RatingStars } from '@/components/molecules/RatingSummary'
import { cn } from '@/utilities/ui'
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  CheckCircle2,
  Eye,
  FileCheck2,
  Lightbulb,
  MapPin,
  MessageSquare,
  MousePointerClick,
  UserRound,
} from 'lucide-react'
import Image from 'next/image'
import { useId } from 'react'

import { ClinicDashboardShell } from './ClinicDashboardShell'
import type {
  ClinicDashboardAction,
  ClinicDashboardRange,
  ClinicDashboardShellData,
  DashboardMetric,
  DashboardOverviewData,
} from './types'

const metricIcons: Record<string, typeof BadgeCheck> = {
  contacts: MessageSquare,
  impressions: Eye,
  'profile-completion': BadgeCheck,
  'profile-views': MousePointerClick,
  requests: FileCheck2,
}

const periodActions: Record<ClinicDashboardRange, ClinicDashboardAction> = {
  '7': 'select-period-7-days',
  '30': 'select-period-30-days',
  '90': 'select-period-90-days',
}

type ClinicDashboardOverviewProps = {
  data: DashboardOverviewData
  mobileNavigationOpen?: boolean
  onAction?: (action: ClinicDashboardAction) => void
  onMobileNavigationOpenChange?: (open: boolean) => void
  shell: ClinicDashboardShellData
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  const Icon = metricIcons[metric.id] ?? CheckCircle2
  const TrendIcon = metric.trend === 'down' ? ArrowDown : ArrowUp

  return (
    <Card className="min-w-0 border-border/90 shadow-sm" title={metric.tooltip}>
      <CardHeader className="flex-row items-start justify-between space-y-0 p-4 pb-2">
        <span className="text-xs font-bold tracking-wide text-foreground/70 uppercase">{metric.label}</span>
        <span className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <strong className="text-2xl tracking-tight">{metric.value}</strong>
          {metric.delta ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-bold',
                metric.trend === 'down' ? 'text-secondary' : 'text-accent-foreground',
              )}
            >
              <TrendIcon aria-hidden="true" className="size-3" />
              {metric.delta}
            </span>
          ) : null}
        </div>
        {typeof metric.progress === 'number' ? (
          <div
            aria-label={`${metric.label}: ${metric.progress}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={metric.progress}
            className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${metric.progress}%` }} />
          </div>
        ) : null}
        {metric.description ? <p className="mt-2 text-xs text-foreground/70">{metric.description}</p> : null}
      </CardContent>
    </Card>
  )
}

function FunnelCard({ data }: { data: DashboardOverviewData }) {
  const icons = [Eye, MousePointerClick, UserRound, MessageSquare, FileCheck2]

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b p-5">
        <Heading align="left" as="h2" className="text-xl" size="h5">
          Konversions-Funnel (30 Tage)
        </Heading>
        <span className="hidden items-center gap-2 text-xs font-bold text-accent-foreground sm:flex">
          <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
          Prozessoptimierung aktiv
        </span>
      </CardHeader>
      <CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
        {data.funnel.map((step, index) => {
          const Icon = icons[index] ?? CheckCircle2
          return (
            <div
              className="relative flex min-w-0 flex-col items-center rounded-lg bg-muted/65 p-4 text-center"
              key={step.label}
            >
              <span className="mb-2 rounded-full bg-primary/10 p-2 text-primary">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              {step.conversion ? (
                <span className="mb-2 rounded-full bg-card px-2 py-1 text-[10px] font-bold text-primary">
                  {step.conversion}
                </span>
              ) : null}
              <strong className="text-lg">{step.value}</strong>
              <span className="text-xs text-foreground/70 uppercase">{step.label}</span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function ProfileProgressCard({ data, onAction }: Pick<ClinicDashboardOverviewProps, 'data' | 'onAction'>) {
  const completionMetric = data.metrics.find((metric) => metric.id === 'profile-completion')

  return (
    <Card className="h-full">
      <CardHeader className="border-b p-5">
        <div className="flex items-center justify-between">
          <Heading align="left" as="h2" className="text-lg" size="h5">
            Profil-Fortschritt
          </Heading>
          <span className="text-sm font-bold text-primary">{completionMetric?.value}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {data.profileTasks.map((task) => (
          <div className="flex items-start justify-between gap-3" key={task.label}>
            <div className="min-w-0">
              <div className="text-sm font-bold">{task.label}</div>
              <span
                className={cn(
                  'text-[10px] font-bold uppercase',
                  task.priority === 'high'
                    ? 'text-secondary'
                    : task.priority === 'medium'
                      ? 'text-secondary'
                      : 'text-accent-foreground',
                )}
              >
                {task.priority === 'high' ? 'Hoch' : task.priority === 'medium' ? 'Mittel' : 'Niedrig'}
              </span>
            </div>
            <Button
              className="h-auto p-0 text-xs"
              onClick={() =>
                onAction?.(
                  task.action === 'Aktivieren'
                    ? 'activate-doctor-profile'
                    : task.action === 'Upload'
                      ? 'upload-certificate'
                      : task.action === 'Prüfen'
                        ? 'check-certificate'
                        : 'fix-profile-task',
                )
              }
              size="clear"
              variant="link"
            >
              {task.action}
            </Button>
          </div>
        ))}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-primary">
            <Lightbulb aria-hidden="true" className="size-4" /> Tipp
          </div>
          <p className="text-xs leading-5 text-foreground/70">
            Vollständige Profile erhalten im Durchschnitt 24% mehr Anfragen.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function StaticLineChart({ data, onAction }: Pick<ClinicDashboardOverviewProps, 'data' | 'onAction'>) {
  const gradientId = useId()
  const max = Math.max(...data.chart.points)
  const min = Math.min(...data.chart.points)
  const denominator = Math.max(1, max - min)
  const coordinates = data.chart.points.map((point, index) => {
    const x = 8 + (index / Math.max(1, data.chart.points.length - 1)) * 84
    const y = 78 - ((point - min) / denominator) * 62
    return { x, y }
  })
  const path = coordinates.reduce((value, point, index, allPoints) => {
    if (index === 0) return `M ${point.x} ${point.y}`

    const previous = allPoints[index - 1]!
    const previousPrevious = allPoints[index - 2] ?? previous
    const next = allPoints[index + 1] ?? point
    const controlOne = {
      x: previous.x + (point.x - previousPrevious.x) / 6,
      y: previous.y + (point.y - previousPrevious.y) / 6,
    }
    const controlTwo = {
      x: point.x - (next.x - previous.x) / 6,
      y: point.y - (next.y - previous.y) / 6,
    }

    return `${value} C ${controlOne.x} ${controlOne.y}, ${controlTwo.x} ${controlTwo.y}, ${point.x} ${point.y}`
  }, '')
  const areaPath = coordinates.length ? `${path} L ${coordinates.at(-1)!.x} 82 L ${coordinates[0]!.x} 82 Z` : undefined

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between space-y-0 border-b p-5">
        <div>
          <Heading align="left" as="h2" className="text-lg" size="h5">
            Profilaufrufe über Zeit
          </Heading>
          <p className="mt-1 text-xs font-bold text-accent-foreground">+12% vs. Vorjahr</p>
        </div>
        <Button
          aria-label="Profilaufrufe herunterladen"
          onClick={() => onAction?.('download-profile-views')}
          size="icon"
          variant="ghost"
        >
          <ArrowDown aria-hidden="true" className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-5">
        <svg
          aria-labelledby="profile-chart-title profile-chart-description"
          className="h-64 w-full xl:h-[23rem]"
          role="img"
          viewBox="0 0 100 90"
        >
          <title id="profile-chart-title">Profilaufrufe der letzten 30 Tage</title>
          <desc id="profile-chart-description">
            Die Kurve steigt insgesamt und enthält zwei deutliche Zwischenrückgänge.
          </desc>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop className="text-primary" offset="0%" stopColor="currentColor" stopOpacity="0.16" />
              <stop className="text-primary" offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[20, 40, 60, 80].map((y) => (
            <line key={y} className="stroke-border" strokeWidth="0.35" x1="5" x2="95" y1={y} y2={y} />
          ))}
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path
            className="fill-none stroke-primary"
            d={path}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
        <div className="grid grid-cols-4 gap-2 text-[10px] text-foreground/70">
          {data.chart.labels.map((label) => (
            <span className="text-center" key={label}>
              {label}
            </span>
          ))}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4">
          {data.chart.summary.map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-foreground/70">{item.label}</dt>
              <dd className="font-bold text-primary">{item.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

function RatingAndPreview({ data, onAction }: Pick<ClinicDashboardOverviewProps, 'data' | 'onAction'>) {
  return (
    <div className="grid h-full gap-6 sm:grid-cols-2 xl:grid-cols-1">
      <Card>
        <CardHeader className="border-b p-5">
          <Heading align="left" as="h2" className="text-lg" size="h5">
            Bewertungen
          </Heading>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <strong className="text-3xl">{data.rating.value.toFixed(1)}</strong>
            <div>
              <RatingStars value={data.rating.value} />
              <div className="mt-1 text-xs text-foreground/70">({data.rating.count})</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.rating.categories.map((category) => (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold" key={category}>
                {category}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="overflow-hidden">
        <Image
          alt={data.clinicPreview.image.alt}
          className="aspect-video w-full object-cover"
          height={180}
          loading="eager"
          src={data.clinicPreview.image.src}
          width={320}
        />
        <CardContent className="space-y-3 p-5">
          <div className="text-xs font-bold text-foreground/70">Klinikprofil Live</div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-bold">{data.clinicPreview.name}</div>
              <div className="mt-1 flex items-center gap-1 text-xs text-foreground/70">
                <MapPin aria-hidden="true" className="size-3" /> {data.clinicPreview.location}
              </div>
            </div>
            <span className="text-xs font-bold text-primary">{data.rating.value.toFixed(1)} ★</span>
          </div>
          <Button className="w-full" onClick={() => onAction?.('open-clinic-preview')} size="sm" variant="primary">
            Vorschau öffnen
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function ClinicDashboardOverview({
  data,
  mobileNavigationOpen,
  onAction,
  onMobileNavigationOpenChange,
  shell,
}: ClinicDashboardOverviewProps) {
  const headerActions = (
    <>
      <Tabs onValueChange={(value) => onAction?.(periodActions[value as ClinicDashboardRange])} value={data.range}>
        <TabsList aria-label="Auswertungszeitraum" className="h-9 p-1">
          {(['7', '30', '90'] as const).map((range) => (
            <TabsTrigger className="h-7 px-3 py-1 text-xs text-foreground/70" key={range} value={range}>
              {range} Tage
            </TabsTrigger>
          ))}
        </TabsList>
        {(['7', '30', '90'] as const).map((range) => (
          <TabsContent className="sr-only" key={range} value={range}>
            Auswertungszeitraum: {range} Tage
          </TabsContent>
        ))}
      </Tabs>
      <Button onClick={() => onAction?.('edit-profile')} size="sm" variant="primary">
        Profil bearbeiten
      </Button>
      <Button
        className="hidden lg:inline-flex"
        onClick={() => onAction?.('open-public-profile')}
        size="sm"
        variant="secondary"
      >
        Öffentliches Profil
      </Button>
    </>
  )

  return (
    <ClinicDashboardShell
      activeSection="dashboard"
      data={shell}
      headerActions={headerActions}
      mobileNavigationOpen={mobileNavigationOpen}
      onAction={onAction}
      onMobileNavigationOpenChange={onMobileNavigationOpenChange}
    >
      <div className="space-y-6">
        <Heading align="left" as="h1" className="sr-only" size="h1">
          Dashboard
        </Heading>
        <section aria-label="Kennzahlen" className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 xl:gap-6">
          {data.metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </section>
        <FunnelCard data={data} />
        <section className="grid gap-6 xl:min-h-[39.5rem] xl:grid-cols-12">
          <div className="xl:col-span-3">
            <ProfileProgressCard data={data} onAction={onAction} />
          </div>
          <div className="xl:col-span-6">
            <StaticLineChart data={data} onAction={onAction} />
          </div>
          <div className="xl:col-span-3">
            <RatingAndPreview data={data} onAction={onAction} />
          </div>
        </section>
      </div>
    </ClinicDashboardShell>
  )
}
