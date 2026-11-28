export function RequiredCue({ label }: { label: string }) {
  return (
    <span className="required">
      * <span className="sr-only">{label}</span>
    </span>
  )
}
