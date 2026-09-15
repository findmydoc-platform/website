export type { TransactionalEmailCommand } from './commands'
export { TransactionalEmailError } from './errors'
export type { TransactionalEmailErrorCode } from './errors'

export type TransactionalEmailAcceptance = {
  operationId: string
  acceptedAt: string
  deduplicated: boolean
}

export type TransactionalEmailCommands = {
  accept(command: import('./commands').TransactionalEmailCommand): Promise<TransactionalEmailAcceptance>
}
