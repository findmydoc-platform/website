import React from 'react'
import Link from 'next/link'
import { Button, type ButtonProps } from '@/components/atoms/button'
import { cn } from '@/utilities/ui'

// This folder is atomic UI. Keep it Payload-free.
export type UiLinkProps = {
  href: string
  appearance?: 'inline' | ButtonProps['variant']
  children?: React.ReactNode
  className?: string
  hoverEffect?: ButtonProps['hoverEffect']
  label?: string | null
  newTab?: boolean
  size?: ButtonProps['size'] | null
  variant?: 'default' | 'footer'
}

export const UiLink: React.FC<UiLinkProps> = (props) => {
  const {
    href,
    appearance = 'inline',
    children,
    className,
    hoverEffect,
    label,
    newTab,
    size: sizeFromProps,
    variant = 'default',
  } = props

  if (!href) return null

  const size = appearance === 'link' ? 'default' : sizeFromProps
  const newTabProps = newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {}

  const variantClasses = variant === 'footer' ? 'text-normal text-muted-foreground hover:text-foreground' : ''

  if (appearance === 'inline') {
    return (
      <Link className={cn(className, variantClasses)} href={href} {...newTabProps}>
        {label && label}
        {children && children}
      </Link>
    )
  }

  return (
    <Button asChild className={className} hoverEffect={hoverEffect} size={size} variant={appearance}>
      <Link className={cn(className, variantClasses)} href={href} {...newTabProps}>
        {label && label}
        {children && children}
      </Link>
    </Button>
  )
}
