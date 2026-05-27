import { readFile } from 'node:fs/promises'
import type { GitHubUploadTokenContext } from '../types'

type HarHeader = {
  name?: string
  value?: string
}

type HarPostParam = {
  name?: string
  value?: string
}

type HarEntry = {
  request?: {
    headers?: HarHeader[]
    postData?: {
      params?: HarPostParam[]
      text?: string
    }
    url?: string
  }
}

type HarFile = {
  log?: {
    entries?: HarEntry[]
  }
}

const getHeader = (headers: HarHeader[] | undefined, name: string): string | undefined => {
  const found = headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())
  return found?.value
}

const getPostParam = (entry: HarEntry, name: string): string | undefined => {
  const params = entry.request?.postData?.params
  const valueFromParams = params?.find((param) => param.name === name)?.value
  if (valueFromParams) {
    return valueFromParams
  }

  const text = entry.request?.postData?.text
  if (!text) {
    return undefined
  }

  const pattern = new RegExp(`name="${name}"\\r?\\n\\r?\\n([^\\r\\n-]+)`)
  return text.match(pattern)?.[1]
}

export const extractUploadTokenContextFromHar = async (harPath: string): Promise<GitHubUploadTokenContext> => {
  const har = JSON.parse(await readFile(harPath, 'utf8')) as HarFile
  const policyEntry = har.log?.entries?.find((entry) =>
    entry.request?.url?.startsWith('https://github.com/upload/policies/assets'),
  )

  if (!policyEntry) {
    throw new Error('No /upload/policies/assets request found in HAR')
  }

  const headers = policyEntry.request?.headers
  const cookieHeader = getHeader(headers, 'cookie')
  const uploadAuthenticityToken = getPostParam(policyEntry, 'authenticity_token')

  if (!cookieHeader) {
    throw new Error('HAR policy request does not contain a cookie header')
  }

  if (!uploadAuthenticityToken) {
    throw new Error('HAR policy request does not contain an upload authenticity_token')
  }

  return {
    clientVersion: getHeader(headers, 'x-github-client-version'),
    cookieHeader,
    fetchNonce: getHeader(headers, 'x-fetch-nonce'),
    repositoryId: getPostParam(policyEntry, 'repository_id'),
    uploadAuthenticityToken,
  }
}

export const resolveUploadAuthenticityToken = (options: {
  explicitToken?: string
  harContext?: GitHubUploadTokenContext
}): string | undefined => {
  return (
    options.explicitToken ?? process.env.GITHUB_UPLOAD_AUTHENTICITY_TOKEN ?? options.harContext?.uploadAuthenticityToken
  )
}
