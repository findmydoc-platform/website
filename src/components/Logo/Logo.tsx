import clsx from 'clsx'
import React from 'react'

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
      width={75}
      height={75}
      loading={loading}
      fetchPriority={priority}
      decoding="async"
      className={clsx('w-[50px] h-[50px] object-contain', className)}
      src="https://cdn2.iconfinder.com/data/icons/diabetes-control-doctor-medical-measuring-devices-/50/54-1024.png"
    />
  )
}
