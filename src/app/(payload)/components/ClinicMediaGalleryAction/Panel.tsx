'use client'

import { Button } from '@payloadcms/ui'
import './index.scss'

export function ClinicMediaGalleryActionPanel({
  dirty,
  busy,
  error,
  status,
  onAdd,
}: {
  dirty: boolean
  busy: boolean
  error?: string
  status?: string
  onAdd: () => void
}) {
  return (
    <div className="clinic-media-gallery-action">
      <p>Add this image to its clinic profile gallery. The image needs alt text.</p>
      {dirty && <p role="status">Save or discard changes before adding this image.</p>}
      {error && <p role="alert">{error}</p>}
      <p role="status" aria-live="polite">
        {busy ? 'Adding image to the clinic gallery…' : status}
      </p>
      <Button type="button" buttonStyle="secondary" disabled={dirty || busy} onClick={onAdd}>
        {busy ? 'Adding image…' : 'Add to clinic gallery'}
      </Button>
    </div>
  )
}
