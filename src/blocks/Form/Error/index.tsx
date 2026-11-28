import { FieldError } from '@/components/atoms/field'

export function Error({ error, id }: { error?: { message?: unknown }; id?: string }) {
  return <FieldError id={id}>{typeof error?.message === 'string' ? error.message : undefined}</FieldError>
}
