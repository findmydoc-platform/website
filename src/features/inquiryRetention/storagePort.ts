export interface InquiryRetentionObjectDeletionPort {
  deleteObjects(objectKeys: readonly string[]): Promise<void>
}
