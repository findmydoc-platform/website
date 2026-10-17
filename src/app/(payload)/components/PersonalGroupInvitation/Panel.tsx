'use client'

import { useId, useState } from 'react'
import './index.scss'
export type PersonalInvitationContact = { email: string; firstName: string; lastName: string }
export function PersonalGroupInvitationPanel({
  onInvite,
  busy = false,
  dirty = false,
  error,
  result,
}: {
  onInvite: (input: PersonalInvitationContact) => Promise<void>
  busy?: boolean
  dirty?: boolean
  error?: string
  result?: string
}) {
  const id = useId()
  const [contact, setContact] = useState({ email: '', firstName: '', lastName: '' })
  const [confirmed, setConfirmed] = useState(false)
  const valid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()) && contact.firstName.trim() && contact.lastName.trim()
  return (
    <fieldset className="personal-group-invitation" disabled={busy} aria-describedby={`${id}-impact`}>
      <legend>Invite a personal group manager</legend>
      <p id={`${id}-impact`}>
        This person receives access to participating clinics in this group after completing their personal invitation.
        Existing staff assignments use the separate staff workflow.
      </p>
      {(
        [
          ['email', 'Personal email'],
          ['firstName', 'First name'],
          ['lastName', 'Last name'],
        ] as const
      ).map(([field, label]) => (
        <label key={field} htmlFor={`${id}-${field}`}>
          {label}
          <input
            id={`${id}-${field}`}
            type={field === 'email' ? 'email' : 'text'}
            value={contact[field]}
            autoComplete="off"
            maxLength={field === 'email' ? 254 : 100}
            onChange={(event) => {
              setContact({ ...contact, [field]: event.target.value })
              setConfirmed(false)
            }}
          />
        </label>
      ))}
      <label className="personal-group-invitation__confirmation">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>I authorize this person to manage this group.</span>
      </label>
      {dirty && <p role="status">Save or discard group changes before preparing an invitation.</p>}
      {error && <p role="alert">{error}</p>}
      {result && <p role="status">{result}</p>}
      <button type="button" disabled={busy || dirty || !valid || !confirmed} onClick={() => void onInvite(contact)}>
        {busy ? 'Preparing invitation…' : 'Prepare personal invitation'}
      </button>
    </fieldset>
  )
}
