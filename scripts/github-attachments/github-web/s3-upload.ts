import { readFile } from 'node:fs/promises'
import { DEFAULT_USER_AGENT, GITHUB_ORIGIN } from '../config'
import type { GitHubUploadPolicy, LocalFileAsset } from '../types'
import { redactSecrets } from '../logger'

export const uploadFileToS3 = async (
  policy: GitHubUploadPolicy,
  file: LocalFileAsset,
  referer: string,
): Promise<number> => {
  const form = new FormData()

  for (const [key, value] of Object.entries(policy.form)) {
    form.set(key, value)
  }

  const buffer = await readFile(file.path)
  form.set('file', new File([buffer], file.name, { type: file.contentType }))

  const response = await fetch(policy.upload_url, {
    body: form,
    headers: {
      accept: '*/*',
      origin: GITHUB_ORIGIN,
      referer,
      'user-agent': DEFAULT_USER_AGENT,
    },
    method: 'POST',
  })

  if (!response.ok && response.status !== 204) {
    const text = await response.text()
    throw new Error(`S3 upload failed: ${response.status} ${redactSecrets(text).slice(0, 500)}`)
  }

  return response.status
}
