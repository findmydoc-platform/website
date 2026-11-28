import React from 'react'
import Link from 'next/link'
import { Button, type ButtonProps } from '@/components/atoms/button'
import { cn } from '@/utilities/ui'

// This folder is atomic UI. Keep it Payload-free.
export type UiLinkProps = {
  href: string
  hrefLang?: string
  appearance?: 'inline' | ButtonProps['variant']
  children?: React.ReactNode
  className?: string
  hoverEffect?: ButtonProps['hoverEffect']
  label?: string | null
  newTab?: boolean
  prefetch?: boolean
  size?: ButtonProps['size'] | null
  shape?: ButtonProps['shape']
  variant?: 'default' | 'content' | 'footer'
}

export const UiLink: React.FC<UiLinkProps> = (props) => {
  const {
    href,
    hrefLang,
    appearance = 'inline',
    children,
    className,
    hoverEffect,
    label,
    newTab,
    prefetch,
    size: sizeFromProps,
    shape,
    variant = 'default',
  } = props

  if (!href) return null

  const size = appearance === 'link' ? 'default' : sizeFromProps
  const newTabProps = newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {}

  const variantClasses = variant === 'footer' ? 'text-normal text-supporting-foreground hover:text-foreground' : ''
  const inlineClasses = variant === 'content' ? 'text-link' : variantClasses

  if (appearance === 'inline') {
    return (
      <Link
        className={cn(className, inlineClasses)}
        href={href}
        hrefLang={hrefLang}
        prefetch={prefetch}
        {...newTabProps}
      >
        {label && label}
        {children && children}
      </Link>
    )
  }

  return (
    <Button asChild className={className} hoverEffect={hoverEffect} size={size} shape={shape} variant={appearance}>
      <Link
        className={cn(className, variantClasses)}
        href={href}
        hrefLang={hrefLang}
        prefetch={prefetch}
        {...newTabProps}
      >
        {label && label}
        {children && children}
      </Link>
    </Button>
  )
}
