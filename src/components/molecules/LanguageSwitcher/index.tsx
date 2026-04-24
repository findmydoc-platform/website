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
        'inline-flex items-center gap-0.5 rounded-full border border-white/35 bg-slate-900/38 p-0.5 backdrop-blur-md sm:gap-1 sm:p-1',
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
              'inline-flex min-w-8 items-center justify-center rounded-full px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase transition-colors sm:min-w-10 sm:px-3 sm:text-xs',
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
