'use client'

import { useId, useState } from 'react'
import './index.scss'

export type MovementGroup = { id: number; name: string }
export function ClinicGroupMovementPanel({
  sourceGroupId,
  groups,
  dirty = false,
  busy = false,
  error,
  onMove,
}: {
  sourceGroupId: number
  groups: MovementGroup[]
  dirty?: boolean
  busy?: boolean
  error?: string
  onMove: (groupId: number | null) => Promise<void>
}) {
  const id = useId()
  const [destination, setDestination] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  return (
    <fieldset className="clinic-group-movement" disabled={busy} aria-describedby={`${id}-impact`}>
      <legend>Move clinic</legend>
      <p id={`${id}-impact`}>
        Former group managers lose access. Destination group managers gain access. Local staff keep their clinic.
      </p>
      <label htmlFor={`${id}-destination`}>Destination</label>
      <select
        id={`${id}-destination`}
        value={destination}
        onChange={(event) => {
          setDestination(event.target.value)
          setConfirmed(false)
        }}
      >
        <option value="">Choose a destination</option>
        <option value="independent">Independent clinic</option>
        {groups
          .filter(({ id }) => id !== sourceGroupId)
          .map((group) => (
            <option key={group.id} value={String(group.id)}>
              {group.name}
            </option>
          ))}
      </select>
      <label className="clinic-group-movement__confirmation">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>I understand that manager access changes immediately.</span>
      </label>
      {dirty && <p role="status">Save or discard the clinic form changes before moving this clinic.</p>}
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={busy || dirty || !confirmed || !destination}
        onClick={() => void onMove(destination === 'independent' ? null : Number(destination))}
      >
        {busy ? 'Moving clinic…' : 'Move clinic'}
      </button>
    </fieldset>
  )
}
