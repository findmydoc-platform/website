import type { IconComponent } from '../types'

export function SupportRow({ icon: Icon, label, value }: { icon: IconComponent; label?: string; value: string }) {
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 text-white">
      <Icon aria-hidden="true" className="mt-0.5 size-4 text-primary" />
      <div className="min-w-0">
        {label ? (
          <span className="block text-[13px] leading-4 font-medium tracking-[0.08em] text-white/55 uppercase">
            {label}
          </span>
        ) : null}
        <span className="block text-[15px] leading-5 font-normal break-words text-white/85">{value}</span>
      </div>
    </div>
  )
}
