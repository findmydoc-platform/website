'use client'

import React from 'react'
import { Button as PayloadButton } from '@payloadcms/ui/elements/Button'
import { RefreshCw } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import type {
  CacheRevalidationVisibilityEvent,
  CacheRevalidationVisibilitySnapshot,
} from '@/utilities/cacheRevalidation/visibility'

export type CacheRevalidationVisibilityCardViewProps = {
  loading: boolean
  accessDenied: boolean
  error: string | null
  snapshot: CacheRevalidationVisibilitySnapshot | null
  onRefresh: () => void
}

const cardStyle: React.CSSProperties = {
  display: 'block',
  border: '1px solid var(--theme-border-color)',
  borderRadius: 'var(--style-radius-m)',
  backgroundColor: 'var(--theme-elevation-0)',
  padding: '1rem',
  color: 'var(--theme-elevation-900)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '0.75rem',
  flexWrap: 'wrap',
}

const metaStyle: React.CSSProperties = {
  marginTop: '0.25rem',
  color: 'var(--theme-elevation-600)',
  fontSize: '0.8125rem',
}

const eventListStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.625rem',
  marginTop: '1rem',
}

const eventCardStyle = (hasFailures: boolean): React.CSSProperties => ({
  border: '1px solid var(--theme-border-color)',
  borderLeft: `4px solid ${hasFailures ? 'var(--theme-error-500)' : 'var(--theme-success-500)'}`,
  borderRadius: 'var(--style-radius-s)',
  backgroundColor: 'var(--theme-elevation-50)',
  padding: '0.75rem',
})

const eventHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '0.75rem',
  flexWrap: 'wrap',
  fontSize: '0.875rem',
  fontWeight: 700,
}

const eventMetaStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.35rem',
  marginTop: '0.5rem',
  color: 'var(--theme-elevation-700)',
  fontSize: '0.8125rem',
}

const inlineListStyle: React.CSSProperties = {
  overflowWrap: 'anywhere',
}

const stateStyle: React.CSSProperties = {
  marginTop: '1rem',
  color: 'var(--theme-elevation-700)',
  fontSize: '0.875rem',
}

const formatEventTime = (timestamp: string): string => {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return timestamp
  return parsed.toLocaleString()
}

const formatList = (values: readonly string[], fallback = 'none'): string => {
  return values.length > 0 ? values.join(', ') : fallback
}

const formatSource = (event: CacheRevalidationVisibilityEvent): string => {
  return event.source.id ? `${event.source.kind}:${event.source.id}` : event.source.kind
}

const formatSubject = (event: CacheRevalidationVisibilityEvent): string => {
  const parts = [event.subject.kind]
  if (event.subject.collection) parts.push(event.subject.collection)
  if (event.subject.global) parts.push(event.subject.global)
  if (event.subject.id) parts.push(event.subject.id)
  return parts.join(':')
}

const EventRow: React.FC<{ event: CacheRevalidationVisibilityEvent }> = ({ event }) => {
  const hasFailures = event.failureCount > 0

  return (
    <article style={eventCardStyle(hasFailures)}>
      <div style={eventHeaderStyle}>
        <span>{event.event}</span>
        <span>{formatEventTime(event.timestamp)}</span>
      </div>
      <div style={eventMetaStyle}>
        <div style={inlineListStyle}>
          Operation: <strong>{event.operation}</strong> · Source: <strong>{formatSource(event)}</strong> · Subject:{' '}
          <strong>{formatSubject(event)}</strong>
        </div>
        <div>
          Tags: <strong>{event.tagCount}</strong> · Paths: <strong>{event.pathCount}</strong> · Failures:{' '}
          <strong>{event.failureCount}</strong>
        </div>
        <div style={inlineListStyle}>Surfaces: {formatList(event.surfaceIds)}</div>
        <div style={inlineListStyle}>
          Tag preview: {formatList(event.tagsPreview)}
          {event.tagsTruncated ? ' ...' : ''}
        </div>
        {event.failureCount > 0 ? (
          <div style={inlineListStyle}>
            Failure preview:{' '}
            {event.failuresPreview.length > 0
              ? event.failuresPreview.map((failure) => `${failure.kind}:${failure.identifier}`).join(', ')
              : 'redacted'}
            {event.failuresTruncated ? ' ...' : ''}
          </div>
        ) : null}
      </div>
    </article>
  )
}

export const CacheRevalidationVisibilityCardView: React.FC<CacheRevalidationVisibilityCardViewProps> = (props) => {
  const events = props.snapshot?.events ?? []
  const statusMessage = props.accessDenied
    ? 'Access denied.'
    : props.error
      ? `Error: ${props.error}`
      : props.loading
        ? props.snapshot
          ? 'Refreshing recent cache events.'
          : 'Loading recent cache events.'
        : props.snapshot && events.length === 0
          ? 'No cache revalidation events recorded yet.'
          : null

  return (
    <section style={cardStyle} aria-label="Cache revalidation visibility">
      <style>{`
        .cache-visibility-touch-action {
          min-height: 44px !important;
          min-width: 44px !important;
          align-items: center !important;
          justify-content: center !important;
        }
      `}</style>
      <div style={headerStyle}>
        <div>
          <Heading as="h4" align="left" className="m-0">
            Cache revalidation visibility
          </Heading>
          <div style={metaStyle}>
            {props.snapshot
              ? `${props.snapshot.count}/${props.snapshot.limit} recent event(s) · ${props.snapshot.droppedOldestCount} older dropped`
              : 'Recent redacted operational cache events'}
          </div>
        </div>
        <PayloadButton
          aria-label="Refresh cache revalidation visibility"
          buttonStyle="secondary"
          className="cache-visibility-touch-action"
          disabled={props.loading}
          icon={<RefreshCw size={14} />}
          margin={false}
          size="small"
          tooltip="Refresh cache revalidation visibility"
          onClick={props.onRefresh}
        >
          Refresh
        </PayloadButton>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {statusMessage ? <div style={stateStyle}>{statusMessage}</div> : null}
      </div>
      {!props.accessDenied && !props.error && events.length > 0 ? (
        <div style={eventListStyle}>
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
