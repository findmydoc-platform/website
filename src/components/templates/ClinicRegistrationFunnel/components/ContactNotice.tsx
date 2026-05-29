export function ContactNotice({ id }: { id: string }) {
  return (
    <p
      className="rounded-[8px] border border-primary/15 bg-primary/10 px-4 py-3 text-xs leading-5 break-words text-card-foreground/75"
      id={id}
    >
      Wir nutzen Ihre Angaben, um Sie im berechtigten Interesse zur Klinikregistrierung zu kontaktieren.
    </p>
  )
}
