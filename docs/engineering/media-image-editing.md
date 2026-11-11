# Media image editing

The five media collections normalize unchanged admin image edits before Payload processes files. Confirming the existing dimensions, a full-frame crop, and the current focal point does not request a reupload. New files and actual edits retain the existing upload validation, ownership, and storage pipeline. Real crops and resizes retain the current focal point for generated sizes, including zero coordinates. Reads used for normalization enforce collection access through the Payload Local API.

## Internal storage updates

The shared `beforeOperationNormalizeImageEdits` hook removes `uploadEdits` while `skipCloudStorage` identifies an internal metadata update. At that point the file has already been processed. The hook replaces the query object without modifying the original query object or other parameters; authentication and transaction context remain intact.

Cloud Storage 3.92.1 also removes `uploadEdits` before its nested metadata update and restores the outer query in a `finally` block. The absence of edit parameters is required during the metadata operation, including when it fails. A retained request reference can contain the outer edit parameters again after the operation returns. A retry is a new user operation with its own edit parameters.

Without this boundary, the metadata update can fetch the new filename through a separate HTTP request before its database transaction commits. Prefix-based file access correctly rejects that uncommitted filename. Do not work around this by weakening file access or removing the prefix.

No cloud-storage dependency patch is required. `tests/integration/mediaImageEdits.test.ts` exercises the unmodified Payload/cloud-storage packages against the integration database and S3Mock. Its HTTP transport routes file requests through the actual Payload REST handler. The regression checks the cropped image's stored dimensions and repeated cropping with a zero focal point verified in the generated image pixels. It also covers unchanged Apply, edit-parameter consumption inside a failing metadata operation, and storage failure.

## Boundaries

Cache impact is `public-cached`: media retains the cache policy and invalidation owners of its public consumers. Existing hooks, tags, and invalidation timing remain unchanged. Preview and private reads stay live.

This fix adds no original archive, schema, or variant model. It does not make database commits and object storage atomic or guarantee cleanup after every later failure. The disabled clinic gallery remains disabled.
