type NativeFinalWriteOperation = 'create' | 'update' | 'delete' | 'restoreVersion'

/** Payload's afterOperation dispatch differs from beforeOperation for single-record writes. */
export function normalizeNativeFinalWriteOperation(operation: string): NativeFinalWriteOperation | null {
  switch (operation) {
    case 'updateByID':
      return 'update'
    case 'deleteByID':
      return 'delete'
    case 'create':
    case 'update':
    case 'delete':
    case 'restoreVersion':
      return operation
    default:
      return null
  }
}
