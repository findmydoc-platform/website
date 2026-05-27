import { DEFAULT_USER_AGENT, GITHUB_ORIGIN } from '../config'
import type { GitHubUploadContext, GitHubUploadPolicy } from '../types'
import { redactSecrets } from '../logger'

export const finalizeUploadedAsset = async (
  context: GitHubUploadContext,
  policy: GitHubUploadPolicy,
): Promise<number> => {
  const form = new FormData()
  form.set('authenticity_token', policy.asset_upload_authenticity_token)

  const assetUploadUrl = new URL(policy.asset_upload_url, GITHUB_ORIGIN)
  const response = await fetch(assetUploadUrl, {
    body: form,
    headers: {
      accept: 'application/json',
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
    method: 'PUT',
  })

  const text = await response.text()

  if (!response.ok) {
    throw new Error(`Asset finalize failed: ${response.status} ${redactSecrets(text).slice(0, 500)}`)
  }

  return response.status
}
