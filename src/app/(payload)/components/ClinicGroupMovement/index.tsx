'use client'

import { useEffect, useState } from 'react'
import { useAuth, useConfig, useDocumentInfo, useForm, useFormModified, useFormProcessing } from '@payloadcms/ui'
import { ClinicGroupMovementPanel, type MovementGroup } from './Panel'

export function ClinicGroupMovement() {
  const { id, initialData, data, apiURL } = useDocumentInfo()
  const { user } = useAuth()
  const { config } = useConfig()
  const { setProcessing } = useForm()
  const dirty = useFormModified()
  const processing = useFormProcessing()
  const savedGroup: unknown = (data ?? initialData)?.group
  const sourceGroupId =
    typeof savedGroup === 'number'
      ? savedGroup
      : savedGroup && typeof savedGroup === 'object' && 'id' in savedGroup
        ? Number(savedGroup.id)
        : null
  const allowed = user?.collection === 'platformStaff' && (user.role === 'admin' || user.role === 'support')
  const [groups, setGroups] = useState<MovementGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState<string>()
  const api = config.routes.api
  useEffect(() => {
    if (!allowed || !id || !sourceGroupId) return
    const controller = new AbortController()
    async function load() {
      try {
        const options: MovementGroup[] = []
        for (let page = 1; ; page++) {
          const response = await fetch(`${api}/clinicGroups?depth=0&limit=100&sort=name,id&page=${page}`, {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          })
          if (!response.ok) throw new Error('Group choices are unavailable. Reload this clinic.')
          const result = (await response.json()) as { docs: MovementGroup[]; hasNextPage: boolean }
          options.push(...result.docs.map(({ id, name }) => ({ id, name })))
          if (!result.hasNextPage) break
        }
        setGroups(options)
      } catch {
        if (!controller.signal.aborted) setError('Group choices are unavailable. Reload this clinic.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [allowed, id, sourceGroupId, api])
  if (!allowed || !id || !sourceGroupId || !apiURL) return null
  const move = async (toGroupId: number | null) => {
    if (dirty || processing || moving || loading) return
    setMoving(true)
    setProcessing(true)
    setError(undefined)
    try {
      const response = await fetch(`${apiURL}/group-membership`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromGroupId: sourceGroupId, toGroupId }),
      })
      if (!response.ok) {
        const result = (await response.json().catch(() => undefined)) as
          { errors?: Array<{ message?: string }> } | undefined
        throw new Error(
          result?.errors?.[0]?.message ?? 'The clinic could not be moved. Reload and check its current group.',
        )
      }
      window.location.reload()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The clinic could not be moved.')
    } finally {
      setMoving(false)
      setProcessing(false)
    }
  }
  return (
    <ClinicGroupMovementPanel
      sourceGroupId={sourceGroupId}
      groups={groups}
      dirty={dirty}
      busy={loading || moving || processing}
      error={error}
      onMove={move}
    />
  )
}
