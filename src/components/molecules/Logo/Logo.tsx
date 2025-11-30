import clsx from 'clsx'
import React from 'react'
import { getServerSideURL } from '@/utilities/getURL'
import canUseDOM from '@/utilities/canUseDOM'

interface Props {
  className?: string
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
  variant?: 'dark' | 'white'
}

export const Logo = (props: Props) => {
  const { loading: loadingFromProps, priority: priorityFromProps, className, variant = 'dark' } = props

  const loading = loadingFromProps || 'lazy'
  const priority = priorityFromProps || 'low'

  const baseUrl = canUseDOM() ? '' : getServerSideURL()

  const logoSrc = `${baseUrl}${variant === 'white' ? '/fmd-logo-1-white.png' : '/fmd-logo-1-dark.png'}`

  return (
    /* eslint-disable @next/next/no-img-element */
    <img
      alt="findmydoc"
      width={200}
      height={75}
      loading={loading}
      fetchPriority={priority}
      decoding="async"
      className={clsx('h-20 w-auto object-contain', className)}
      src={logoSrc}
    />
  )
}
