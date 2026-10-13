import type { NotificationErrorCode } from './contracts'

export class ClinicNotificationError extends Error {
  constructor(readonly code: NotificationErrorCode) {
    super(code)
    this.name = 'ClinicNotificationError'
  }
}

export class ClinicNotificationCaptureConflict extends Error {
  constructor() {
    super('Notification capture activation changed concurrently.')
    this.name = 'ClinicNotificationCaptureConflict'
  }
}
