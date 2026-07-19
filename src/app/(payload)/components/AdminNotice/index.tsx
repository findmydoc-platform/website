'use client'

import { Banner } from '@payloadcms/ui/elements/Banner'
import { CircleCheck, CircleX, ExternalLink, Info, TriangleAlert, type LucideIcon } from 'lucide-react'

import './index.scss'

export const ADMIN_NOTICE_VARIANTS = ['info', 'success', 'warning', 'error'] as const

export type AdminNoticeVariant = (typeof ADMIN_NOTICE_VARIANTS)[number]

export type AdminNoticeGuideLink = Readonly<{
  href: string
  label: string
  newTab?: boolean
}>

export type AdminNoticeProps = Readonly<{
  description: string
  guideLink?: AdminNoticeGuideLink
  title: string
  variant?: AdminNoticeVariant
}>

type PayloadBannerType = 'default' | 'error' | 'info' | 'success'

const VARIANT_CONFIG = {
  info: { bannerType: 'info', Icon: Info },
  success: { bannerType: 'success', Icon: CircleCheck },
  warning: { bannerType: 'default', Icon: TriangleAlert },
  error: { bannerType: 'error', Icon: CircleX },
} as const satisfies Record<AdminNoticeVariant, { bannerType: PayloadBannerType; Icon: LucideIcon }>

export function AdminNotice({ description, guideLink, title, variant = 'info' }: AdminNoticeProps) {
  const { bannerType, Icon } = VARIANT_CONFIG[variant]
  const opensNewTab = guideLink?.newTab === true

  return (
    <aside aria-label={title} className="admin-notice">
      <Banner
        alignIcon="left"
        className={`admin-notice__banner admin-notice__banner--${variant}`}
        icon={<Icon aria-hidden="true" size={22} />}
        type={bannerType}
      >
        <div className="admin-notice__content">
          <p className="admin-notice__title">{title}</p>
          <p className="admin-notice__description">{description}</p>
          {guideLink ? (
            <a
              aria-label={`${guideLink.label}${opensNewTab ? ' (opens in a new tab)' : ''}`}
              className="admin-notice__guide-link"
              href={guideLink.href}
              rel={opensNewTab ? 'noreferrer noopener' : undefined}
              target={opensNewTab ? '_blank' : undefined}
            >
              <span>{guideLink.label}</span>
              {opensNewTab ? <ExternalLink aria-hidden="true" size={15} /> : null}
            </a>
          ) : null}
        </div>
      </Banner>
    </aside>
  )
}
