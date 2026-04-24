import { expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test'
import { resolvePlaywrightBaseURL } from '../../../scripts/test-env.mjs'
import type { AdminJourneyStep } from './adminJourneys/types'

export type CollectionListResponse = {
  docs?: Array<Record<string, unknown>>
}

export type CreatedDocResponse = {
  doc?: Record<string, unknown>
}

export type RecordId = number | string

export const getRecordId = (value: unknown): RecordId | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  if (value && typeof value === 'object') {
    const candidate = (value as { id?: unknown; value?: unknown }).id ?? (value as { value?: unknown }).value
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      return candidate
    }
  }

  return undefined
}

export const getFirstCollectionDoc = async (request: APIRequestContext, path: string) => {
  const response = await request.get(path)
  expect(response.ok()).toBeTruthy()

  const body = (await response.json()) as CollectionListResponse
  return body.docs?.[0]
}

export const createSessionBoundRequestContext = async (
  storageStatePath: string,
  baseURL = resolvePlaywrightBaseURL(),
) => {
  return playwrightRequest.newContext({
    baseURL,
    storageState: storageStatePath,
  })
}

export const buildCollectionQueryPath = (
  collectionSlug: string,
  filters: Record<string, RecordId>,
  options: {
    sort?: string
  } = {},
) => {
  const params = new URLSearchParams({
    depth: '0',
    limit: '1',
    sort: options.sort ?? '-createdAt',
  })

  for (const [field, value] of Object.entries(filters)) {
    params.set(`where[${field}][equals]`, String(value))
  }

  return `/api/${collectionSlug}?${params.toString()}`
}

export const readRequiredCollectionDocByFilters = async (
  request: Parameters<AdminJourneyStep<Record<string, unknown>>['run']>[0]['request'],
  collectionSlug: string,
  filters: Record<string, RecordId>,
) => {
  const doc = await getFirstCollectionDoc(request, buildCollectionQueryPath(collectionSlug, filters))
  expect(doc).toBeTruthy()
  return doc as Record<string, unknown>
}

export const readRequiredCollectionDocById = async (
  request: Parameters<AdminJourneyStep<Record<string, unknown>>['run']>[0]['request'],
  collectionSlug: string,
  recordId: RecordId,
) => readRequiredCollectionDocByFilters(request, collectionSlug, { id: recordId })
