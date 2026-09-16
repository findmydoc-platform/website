export type TransactionalEmailErrorCode =
  | 'unsupported-command'
  | 'invalid-command'
  | 'access-denied'
  | 'source-missing'
  | 'transaction-conflict'
  | 'storage-unavailable'
  | 'environment-unavailable'

export class TransactionalEmailError extends Error {
  constructor(readonly code: TransactionalEmailErrorCode) {
    super(code)
    this.name = 'TransactionalEmailError'
  }
}
