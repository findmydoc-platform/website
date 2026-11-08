'use client'

import { Button } from '@payloadcms/ui'
import './index.scss'

export function ClinicMediaGalleryActionPanel({
  dirty,
  busy,
  error,
  onAdd,
}: {
  dirty: boolean
  busy: boolean
  error?: string
  onAdd: () => void
}) {
  return (
    <div className="clinic-media-gallery-action">
      <p>Add this image to its clinic profile gallery. The image needs alt text.</p>
      {dirty && <p role="status">Save or discard changes before adding this image.</p>}
      {error && <p role="alert">{error}</p>}
      <Button type="button" buttonStyle="secondary" disabled={dirty || busy} onClick={onAdd}>
        {busy ? 'Adding image…' : 'Add to clinic gallery'}
      </Button>
    </div>
  )
}
