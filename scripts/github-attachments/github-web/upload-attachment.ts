import type { GitHubUploadContext, UploadedAttachment } from '../types'
import { finalizeUploadedAsset } from './finalize-asset'
import { resolveLocalFileAsset } from './file-asset'
import { requestUploadPolicy } from './upload-policy'
import { uploadFileToS3 } from './s3-upload'

export const uploadAttachment = async (context: GitHubUploadContext, filePath: string): Promise<UploadedAttachment> => {
  const file = await resolveLocalFileAsset(filePath)
  const policy = await requestUploadPolicy(context, file)
  const s3Status = await uploadFileToS3(policy, file, context.referer)
  const finalStatus = await finalizeUploadedAsset(context, policy)

  return {
    assetHref: policy.asset.href,
    assetId: policy.asset.id,
    finalStatus,
    s3Status,
  }
}
