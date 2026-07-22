'use client'

import { CircleCheck, CircleDashed, CircleX, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useId } from 'react'

import './index.scss'

export type RequirementsChecklistItem = Readonly<{
  id: string
  label: string
  status: 'complete' | 'error' | 'incomplete' | 'loading'
}>

type RequirementsChecklistProps = Readonly<{
  inactiveSummary: string
  isEnforced: boolean
  items: readonly RequirementsChecklistItem[]
  title: string
}>

export function RequirementsChecklist({ inactiveSummary, isEnforced, items, title }: RequirementsChecklistProps) {
  const titleId = useId()
  const hasError = items.some((item) => item.status === 'error')
  const isLoading = items.some((item) => item.status === 'loading')
  const missingCount = items.filter((item) => item.status === 'incomplete').length
  const isReady = missingCount === 0
  const tone = hasError
    ? 'error'
    : isLoading
      ? 'info'
      : isEnforced && !isReady
        ? 'warning'
        : isReady
          ? 'success'
          : 'info'
  const summary = isEnforced
    ? hasError
      ? 'Some requirements could not be checked.'
      : isLoading
        ? 'Checking requirements…'
        : isReady
          ? 'All requirements are complete.'
          : `${missingCount} ${missingCount === 1 ? 'requirement is' : 'requirements are'} incomplete.`
    : inactiveSummary

  return (
    <section aria-labelledby={titleId} className={`requirements-checklist requirements-checklist--${tone}`}>
      <div className="requirements-checklist__heading">
        {hasError ? (
          <CircleX aria-hidden="true" size={20} />
        ) : isLoading ? (
          <LoaderCircle aria-hidden="true" className="requirements-checklist__spinner" size={20} />
        ) : isEnforced && !isReady ? (
          <TriangleAlert aria-hidden="true" size={20} />
        ) : isReady ? (
          <CircleCheck aria-hidden="true" size={20} />
        ) : (
          <CircleDashed aria-hidden="true" size={20} />
        )}
        <div>
          <h3 id={titleId}>{title}</h3>
          <p aria-live="polite">{summary}</p>
        </div>
      </div>

      <ul className="requirements-checklist__list">
        {items.map((item) => (
          <li
            className={item.status === 'complete' ? 'requirements-checklist__item--complete' : undefined}
            key={item.id}
          >
            {item.status === 'complete' ? <CircleCheck aria-hidden="true" size={17} /> : null}
            {item.status === 'incomplete' ? <CircleDashed aria-hidden="true" size={17} /> : null}
            {item.status === 'loading' ? (
              <LoaderCircle aria-hidden="true" className="requirements-checklist__spinner" size={17} />
            ) : null}
            {item.status === 'error' ? <CircleX aria-hidden="true" size={17} /> : null}
            <span>{item.label}</span>
            <span className="requirements-checklist__sr-only">
              {item.status === 'complete' ? 'Complete' : null}
              {item.status === 'incomplete' ? 'Missing' : null}
              {item.status === 'loading' ? 'Checking' : null}
              {item.status === 'error' ? 'Unavailable' : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
