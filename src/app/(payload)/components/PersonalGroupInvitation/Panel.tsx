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
  const [touched, setTouched] = useState<Partial<Record<keyof PersonalInvitationContact, boolean>>>({})
  const errors = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()) ? '' : 'Enter a valid personal email address.',
    firstName: contact.firstName.trim() ? '' : 'Enter a first name.',
    lastName: contact.lastName.trim() ? '' : 'Enter a last name.',
  }
  const valid = Object.values(errors).every((error) => !error)
  return (
    <fieldset
      className="personal-group-invitation"
      disabled={busy}
      aria-describedby={`${id}-impact ${id}-requirements`}
    >
      <legend>Invite a personal group manager</legend>
      <p id={`${id}-impact`}>
        This person receives access to participating clinics in this group after completing their personal invitation.
        Existing staff assignments use the separate staff workflow.
      </p>
      <p id={`${id}-requirements`}>All contact fields and the authorization confirmation are required.</p>
      {(
        [
          ['email', 'Personal email'],
          ['firstName', 'First name'],
          ['lastName', 'Last name'],
        ] as const
      ).map(([field, label]) => (
        <div key={field}>
          <label htmlFor={`${id}-${field}`}>{label}</label>
          <input
            id={`${id}-${field}`}
            type={field === 'email' ? 'email' : 'text'}
            value={contact[field]}
            autoComplete="off"
            aria-required="true"
            aria-invalid={touched[field] && Boolean(errors[field]) ? true : undefined}
            aria-describedby={touched[field] && errors[field] ? `${id}-${field}-error` : undefined}
            onBlur={() => setTouched((current) => ({ ...current, [field]: true }))}
            maxLength={field === 'email' ? 254 : 100}
            onChange={(event) => {
              setContact({ ...contact, [field]: event.target.value })
              setConfirmed(false)
            }}
          />
          {touched[field] && errors[field] && (
            <p id={`${id}-${field}-error`} aria-live="polite">
              {errors[field]}
            </p>
          )}
        </div>
      ))}
      <label className="personal-group-invitation__confirmation">
        <input
          type="checkbox"
          aria-required="true"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
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
