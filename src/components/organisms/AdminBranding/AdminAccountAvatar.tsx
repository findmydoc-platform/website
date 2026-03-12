'use client'

import { useAuth, useConfig, usePayloadAPI } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'
import { formatAdminURL } from 'payload/shared'
import React from 'react'

type BasicUserLike = {
  collection?: string | null
  profileImage?: unknown
}

type MeResponseLike = {
  user?: {
    profileImage?: unknown
  } | null
}

type MediaLike = {
  id?: number | string | null
  url?: string | null
  thumbnailURL?: string | null
  sizes?: {
    thumbnail?: {
      url?: string | null
    } | null
  } | null
}

const ACCOUNT_ICON_BASE_CLASS = 'graphic-account'
const PROFILE_MEDIA_COLLECTION = 'userProfileMedia'

const normalizeURL = (value: string): string => {
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
    return value
  }

  if (value.startsWith('/')) {
    return value
  }

  return `/${value}`
}

const getMediaURL = (value: unknown): string | null => {
  if (!value) return null

  if (typeof value === 'string') {
    if (/^\d+$/.test(value)) return null
    return normalizeURL(value)
  }

  if (typeof value !== 'object') {
    return null
  }

  const media = value as MediaLike
  const urlCandidate = media.sizes?.thumbnail?.url || media.thumbnailURL || media.url

  if (typeof urlCandidate === 'string' && urlCandidate.length > 0) {
    return normalizeURL(urlCandidate)
  }

  return null
}

const getMediaID = (value: unknown): null | number | string => {
  if (typeof value === 'number') return value

  if (typeof value === 'string') {
    if (/^\d+$/.test(value)) {
      return value
    }

    return null
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const mediaID = (value as MediaLike).id

  if (typeof mediaID === 'number') return mediaID
  if (typeof mediaID === 'string' && mediaID.length > 0) return mediaID

  return null
}

const buildAPIPath = (apiRoute: string, path: `/${string}`): string => {
  return formatAdminURL({ apiRoute, path })
}

const renderDefaultIcon = (isOnAccountPage: boolean): React.JSX.Element => (
  <svg
    className={[ACCOUNT_ICON_BASE_CLASS, isOnAccountPage && `${ACCOUNT_ICON_BASE_CLASS}--active`]
      .filter(Boolean)
      .join(' ')}
    height="25"
    viewBox="0 0 25 25"
    width="25"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle className={`${ACCOUNT_ICON_BASE_CLASS}__bg`} cx="12.5" cy="12.5" r="11.5" />
    <circle className={`${ACCOUNT_ICON_BASE_CLASS}__head`} cx="12.5" cy="10.73" r="3.98" />
    <path
      className={`${ACCOUNT_ICON_BASE_CLASS}__body`}
      d="M12.5,24a11.44,11.44,0,0,0,7.66-2.94c-.5-2.71-3.73-4.8-7.66-4.8s-7.16,2.09-7.66,4.8A11.44,11.44,0,0,0,12.5,24Z"
    />
  </svg>
)

export const AdminAccountAvatar: React.FC = () => {
  const { config } = useConfig()
  const { user } = useAuth<BasicUserLike>()
  const pathname = usePathname()

  const accountPath = formatAdminURL({
    adminRoute: config.routes.admin,
    path: config.admin.routes.account,
  })
  const isOnAccountPage = pathname === accountPath

  const userCollection = typeof user?.collection === 'string' ? user.collection : config.admin.user
  const meEndpoint = userCollection ? buildAPIPath(config.routes.api, `/${userCollection}/me` as `/${string}`) : ''

  const [{ data: meData }] = usePayloadAPI(meEndpoint, {
    initialParams: { depth: 1 },
  })

  const profileImageValue =
    (meData as MeResponseLike | undefined)?.user?.profileImage !== undefined
      ? (meData as MeResponseLike).user?.profileImage
      : user?.profileImage

  const embeddedMediaURL = React.useMemo(() => getMediaURL(profileImageValue), [profileImageValue])
  const mediaID = React.useMemo(() => getMediaID(profileImageValue), [profileImageValue])

  const mediaEndpoint = React.useMemo(() => {
    if (embeddedMediaURL || !mediaID) return ''
    return buildAPIPath(config.routes.api, `/${PROFILE_MEDIA_COLLECTION}/${mediaID}` as `/${string}`)
  }, [config.routes.api, embeddedMediaURL, mediaID])

  const [{ data: mediaData }] = usePayloadAPI(mediaEndpoint)
  const fetchedMediaURL = React.useMemo(() => getMediaURL(mediaData), [mediaData])

  const finalMediaURL = embeddedMediaURL || fetchedMediaURL
  const [imageFailed, setImageFailed] = React.useState(false)

  React.useEffect(() => {
    setImageFailed(false)
  }, [finalMediaURL])

  if (finalMediaURL && !imageFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt="account avatar"
        className={['fmd-admin-account-avatar', isOnAccountPage && 'fmd-admin-account-avatar--active']
          .filter(Boolean)
          .join(' ')}
        height={25}
        src={finalMediaURL}
        width={25}
        onError={() => setImageFailed(true)}
      />
    )
  }

  return renderDefaultIcon(isOnAccountPage)
}

export default AdminAccountAvatar
