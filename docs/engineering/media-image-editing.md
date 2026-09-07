# Media image editing

The five media collections normalize unchanged admin image edits before Payload processes files. Confirming the existing dimensions, a full-frame crop, and the current focal point does not request a reupload. New files and actual edits retain the existing upload validation, ownership, and storage pipeline. Reads used for normalization enforce collection access through the Payload Local API.

## Cloud storage compatibility

The pnpm patch for `@payloadcms/plugin-cloud-storage@3.88.0` removes `uploadEdits` from the query during the plugin's internal metadata update and restores the original query in `finally`. The same authenticated request and transaction remain in use. `skipCloudStorage` only prevents recursion into the storage hook; it does not prevent Payload's earlier image-processing step.

Without the patch, a crop can upload successfully and then fail when the metadata update fetches the new filename through a separate HTTP request before its database transaction commits. Prefix-based file access correctly rejects that uncommitted filename. Do not work around this by weakening file access or removing the prefix.

`tests/integration/mediaImageEdits.test.ts` exercises real Payload operations and cloud storage against the integration database and S3Mock. Its HTTP transport routes file requests through the actual Payload REST handler. Keep this regression when upgrading Payload. Remove the version-specific patch only after an upstream version passes the same edit and error-restoration cases without it.

## Boundaries

Cache impact is `public-cached`: media retains the cache policy and invalidation owners of its public consumers. Existing hooks, tags, and invalidation timing remain unchanged. Preview and private reads stay live.

This fix adds no original archive, schema, or variant model. It does not make database commits and object storage atomic or guarantee cleanup after every later failure. The disabled clinic gallery remains disabled.
