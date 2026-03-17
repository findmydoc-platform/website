import Link from 'next/link'

import { cn } from '@/utilities/ui'

export type LanguageSwitcherOption = {
  href: string
  label: string
  value: string
}

type LanguageSwitcherProps = {
  ariaLabel?: string
  className?: string
  currentValue: string
  options: LanguageSwitcherOption[]
}

export function LanguageSwitcher({
  ariaLabel = 'Language switcher',
  className,
  currentValue,
  options,
}: LanguageSwitcherProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-white/35 bg-slate-900/38 p-1 backdrop-blur-md',
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === currentValue

        return (
          <Link
            key={option.value}
            href={option.href}
            className={cn(
              'inline-flex min-w-10 items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.14em] uppercase transition-colors',
              isActive
                ? 'bg-white text-slate-900'
                : 'text-white/88 hover:bg-white/12 hover:text-white focus-visible:bg-white/16',
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            {option.label}
          </Link>
        )
      })}
    </nav>
  )
}
