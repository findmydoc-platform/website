import { DEFAULT_USER_AGENT, GITHUB_ORIGIN } from '../config'
import type { GitHubUploadContext, GitHubUploadPolicy, LocalFileAsset } from '../types'
import { redactSecrets } from '../logger'

export const requestUploadPolicy = async (
  context: GitHubUploadContext,
  file: LocalFileAsset,
): Promise<GitHubUploadPolicy> => {
  const form = new FormData()
  form.set('repository_id', context.repositoryId)
  form.set('name', file.name)
  form.set('size', String(file.size))
  form.set('content_type', file.contentType)
  if (context.uploadAuthenticityToken) {
    form.set('authenticity_token', context.uploadAuthenticityToken)
  }

  const response = await fetch(`${GITHUB_ORIGIN}/upload/policies/assets`, {
    body: form,
    headers: {
      accept: '*/*',
      cookie: context.cookieHeader,
      'github-verified-fetch': 'true',
      origin: GITHUB_ORIGIN,
      referer: context.referer,
      'sec-ch-ua': '"Chromium";v="148", "HeadlessChrome";v="148", "Not/A)Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'user-agent': DEFAULT_USER_AGENT,
      'x-fetch-nonce': context.fetchNonce ?? '',
      'x-github-client-version': context.clientVersion ?? '',
      'x-requested-with': 'XMLHttpRequest',
    },
    method: 'POST',
  })

  const text = await response.text()

  if (!response.ok) {
    throw new Error(`Upload policy request failed: ${response.status} ${redactSecrets(text).slice(0, 500)}`)
  }

  const policy = JSON.parse(text) as GitHubUploadPolicy

  if (
    !policy.upload_url ||
    !policy.asset?.href ||
    !policy.asset_upload_url ||
    !policy.asset_upload_authenticity_token
  ) {
    throw new Error('Upload policy response is missing required fields')
  }

  return policy
}
