export type GitHubTargetKind = 'issue' | 'pull'

export type GitHubTarget = {
  kind: GitHubTargetKind
  number: number
  owner: string
  repo: string
  url: string
}

export type GitHubWebHeaders = {
  clientVersion?: string
  cookieHeader: string
  fetchNonce?: string
  referer: string
}

export type GitHubPageContext = GitHubWebHeaders & {
  repositoryId?: string
  target: GitHubTarget
}

export type GitHubUploadTokenContext = Partial<GitHubPageContext> & {
  uploadAuthenticityToken?: string
}

export type GitHubUploadContext = GitHubPageContext & {
  repositoryId: string
  uploadAuthenticityToken?: string
}

export type GitHubUploadAsset = {
  href: string
  id?: number | string
  name?: string
}

export type GitHubUploadPolicy = {
  asset: GitHubUploadAsset
  asset_upload_authenticity_token: string
  asset_upload_url: string
  form: Record<string, string>
  upload_url: string
}

export type LocalFileAsset = {
  contentType: string
  name: string
  path: string
  size: number
}

export type UploadedAttachment = {
  assetHref: string
  assetId?: number | string
  finalStatus: number
  s3Status: number
}

export type SessionCookie = {
  domain?: string
  expires?: number
  name: string
  path?: string
  value: string
}

export type PlaywrightStorageStateLike = {
  cookies?: SessionCookie[]
}
