import clsx from 'clsx'
import React from 'react'
import { getServerSideURL } from '../../utilities/getURL'

interface Props {
  className?: string
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
}

export const Logo = (props: Props) => {
  const { loading: loadingFromProps, priority: priorityFromProps, className } = props

  const loading = loadingFromProps || 'lazy'
  const priority = priorityFromProps || 'low'

  return (
    /* eslint-disable @next/next/no-img-element */
    <img
      alt="findmydoc"
      width={200}
      height={75}
      loading={loading}
      fetchPriority={priority}
      decoding="async"
      className={clsx('w-[200px] h-[75px] object-contain', className)}
      src={`${getServerSideURL()}/fmd-logo-1-dark.png`}
    />
  )
}
