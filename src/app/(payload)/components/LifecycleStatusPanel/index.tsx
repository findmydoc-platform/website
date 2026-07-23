'use client'

import { CircleCheck, CircleDashed, CircleX, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useId } from 'react'

import './index.scss'

export type LifecycleStatusPanelDetail = Readonly<{
  label: string
  value: ReactNode
}>

type LifecycleStatusPanelProps = Readonly<{
  details?: readonly LifecycleStatusPanelDetail[]
  guidance: ReactNode
  stateLabel: string
  summary: ReactNode
  title: string
  tone: 'error' | 'info' | 'success' | 'warning'
}>

const StateIcon = ({ tone }: Pick<LifecycleStatusPanelProps, 'tone'>) => {
  if (tone === 'success') return <CircleCheck aria-hidden="true" size={20} />
  if (tone === 'warning') return <TriangleAlert aria-hidden="true" size={20} />
  if (tone === 'error') return <CircleX aria-hidden="true" size={20} />
  return <CircleDashed aria-hidden="true" size={20} />
}

export function LifecycleStatusPanel({
  details = [],
  guidance,
  stateLabel,
  summary,
  title,
  tone,
}: LifecycleStatusPanelProps) {
  const titleId = useId()

  return (
    <section
      aria-labelledby={titleId}
      className={`lifecycle-status-panel lifecycle-status-panel--${tone}`}
      data-lifecycle-state={stateLabel}
    >
      <div className="lifecycle-status-panel__heading">
        <StateIcon tone={tone} />
        <div>
          <h3 id={titleId}>{title}</h3>
          <p className="lifecycle-status-panel__state">{stateLabel}</p>
          <p aria-live="polite" className="lifecycle-status-panel__summary">
            {summary}
          </p>
        </div>
      </div>

      {details.length > 0 ? (
        <dl className="lifecycle-status-panel__details">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="lifecycle-status-panel__guidance">{guidance}</p>
    </section>
  )
}
