'use client'

import * as React from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { cn } from '@/utilities/ui'

type FavoriteClinicButtonVariant = 'compact' | 'hero' | 'icon' | 'list'

export type FavoriteClinicButtonChange = {
  isFavorite: boolean
  favoriteId: number | null
}

export type FavoriteClinicButtonProps = {
  clinicId: number
  initialFavoriteId?: number | null
  isPatient: boolean
  loginHref: string
  variant?: FavoriteClinicButtonVariant
  savedLabel?: string
  unsavedLabel?: string
  pendingLabel?: string
  buttonAriaLabel?: string
  pendingAriaLabel?: string
  showIcon?: boolean
  className?: string
  onFavoriteChange?: (change: FavoriteClinicButtonChange) => void
}

type FavoriteClinicApiDoc = {
  id?: unknown
  doc?: {
    id?: unknown
  }
}

type FavoriteClinicApiListResponse = {
  docs?: FavoriteClinicApiDoc[]
}

const VARIANT_CLASSNAMES: Record<FavoriteClinicButtonVariant, string> = {
  compact: 'h-12 w-full gap-2 px-4 text-sm font-semibold md:h-10',
  hero: 'h-12 w-full gap-2 px-5 text-sm font-semibold sm:w-auto',
  icon: 'size-11 rounded-full p-0 shadow-xs backdrop-blur',
  list: 'h-11 w-full gap-2 px-4 text-sm font-semibold',
}

function toFavoriteId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function toFavoriteIdFromDoc(value: FavoriteClinicApiDoc | null | undefined): number | null {
  return toFavoriteId(value?.id) ?? toFavoriteId(value?.doc?.id)
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    message?: unknown
    errors?: unknown
    error?: unknown
  } | null
  const fallback = 'We could not update your saved clinics. Please try again.'

  if (typeof body?.message === 'string' && body.message.trim().length > 0) return body.message
  if (typeof body?.error === 'string' && body.error.trim().length > 0) return body.error

  return fallback
}

async function findExistingFavoriteId(clinicId: number): Promise<number | null> {
  const params = new URLSearchParams({
    depth: '0',
    limit: '1',
  })
  params.set('where[clinic][equals]', String(clinicId))

  const response = await fetch(`/api/favoriteclinics?${params.toString()}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  })

  if (!response.ok) return null

  const body = (await response.json().catch(() => null)) as FavoriteClinicApiListResponse | null
  const firstDoc = body?.docs?.[0]
  return toFavoriteIdFromDoc(firstDoc)
}

async function createFavorite(clinicId: number): Promise<number> {
  const response = await fetch('/api/favoriteclinics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify({ clinic: clinicId }),
  })

  if (response.ok) {
    const body = (await response.json().catch(() => null)) as FavoriteClinicApiDoc | null
    const favoriteId = toFavoriteIdFromDoc(body)
    if (favoriteId) return favoriteId
  }

  const reconciledFavoriteId = await findExistingFavoriteId(clinicId)
  if (reconciledFavoriteId) return reconciledFavoriteId

  throw new Error(await readErrorMessage(response))
}

async function deleteFavorite(favoriteId: number): Promise<void> {
  const response = await fetch(`/api/favoriteclinics/${encodeURIComponent(String(favoriteId))}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }
}

export function FavoriteClinicButton({
  clinicId,
  initialFavoriteId = null,
  isPatient,
  loginHref,
  variant = 'compact',
  savedLabel = 'Saved',
  unsavedLabel = 'Save',
  pendingLabel = 'Saving...',
  buttonAriaLabel,
  pendingAriaLabel,
  showIcon = true,
  className,
  onFavoriteChange,
}: FavoriteClinicButtonProps) {
  const [favoriteId, setFavoriteId] = React.useState<number | null>(initialFavoriteId)
  const [isPending, setIsPending] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const isFavorite = favoriteId !== null
  const label = isPending ? pendingLabel : isFavorite ? savedLabel : unsavedLabel
  const isIconVariant = variant === 'icon'
  const shouldShowIcon = isIconVariant || showIcon
  const content = isIconVariant ? <span className="sr-only">{label}</span> : label
  const accessibleLabel = isPending ? (pendingAriaLabel ?? buttonAriaLabel) : buttonAriaLabel
  const buttonVariant = isIconVariant
    ? 'secondary'
    : variant === 'list'
      ? 'secondary'
      : isFavorite
        ? 'primary'
        : 'secondary'

  React.useEffect(() => {
    setFavoriteId(initialFavoriteId ?? null)
  }, [initialFavoriteId])

  const emitChange = React.useCallback(
    (change: FavoriteClinicButtonChange) => {
      onFavoriteChange?.(change)
    },
    [onFavoriteChange],
  )

  const handleToggle = () => {
    if (isPending) return

    setErrorMessage(null)
    const previousFavoriteId = favoriteId
    const nextIsFavorite = !isFavorite

    setIsPending(true)
    void (async () => {
      try {
        if (nextIsFavorite) {
          const createdFavoriteId = await createFavorite(clinicId)
          setFavoriteId(createdFavoriteId)
          emitChange({ isFavorite: true, favoriteId: createdFavoriteId })
          return
        }

        if (previousFavoriteId) {
          await deleteFavorite(previousFavoriteId)
        }

        setFavoriteId(null)
        emitChange({ isFavorite: false, favoriteId: null })
      } catch (error: unknown) {
        setFavoriteId(previousFavoriteId)
        setErrorMessage(error instanceof Error ? error.message : 'We could not update your saved clinics.')
      } finally {
        setIsPending(false)
      }
    })()
  }

  if (!isPatient) {
    return (
      <Button
        asChild
        variant="secondary"
        className={cn(
          VARIANT_CLASSNAMES[variant],
          isIconVariant ? 'bg-card/95 text-primary hover:bg-primary/5' : undefined,
          className,
        )}
      >
        <Link href={loginHref} aria-label={buttonAriaLabel}>
          {shouldShowIcon ? <Heart className="size-4" aria-hidden={true} /> : null}
          {isIconVariant ? <span className="sr-only">{unsavedLabel}</span> : unsavedLabel}
        </Link>
      </Button>
    )
  }

  return (
    <div className={cn('min-w-0 space-y-1', variant === 'compact' ? 'w-full' : undefined, isIconVariant && 'relative')}>
      <Button
        type="button"
        variant={buttonVariant}
        aria-pressed={isFavorite}
        aria-label={accessibleLabel}
        disabled={isPending}
        className={cn(
          VARIANT_CLASSNAMES[variant],
          isIconVariant && 'bg-card/95 text-primary hover:bg-primary/5',
          isIconVariant && isFavorite && 'border-primary/40 bg-primary/10 hover:bg-primary/15',
          className,
        )}
        onClick={handleToggle}
      >
        {shouldShowIcon ? (
          <Heart className={cn('size-4', isFavorite ? 'fill-current' : undefined)} aria-hidden={true} />
        ) : null}
        {content}
      </Button>
      <p
        aria-live="polite"
        className={cn(
          isIconVariant
            ? errorMessage
              ? 'absolute top-full right-0 z-20 mt-1 w-48 rounded-md border border-border bg-card px-2 py-1 text-xs leading-5 text-destructive shadow-sm'
              : 'sr-only'
            : 'min-h-5 text-xs leading-5 text-destructive',
        )}
      >
        {errorMessage}
      </p>
    </div>
  )
}
