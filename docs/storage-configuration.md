# Setting Up Storage

## Storage Options

The FindMyDoc portal supports two storage options:

1. **Local Storage**: Files stored on your server's filesystem (default in development)
2. **S3-Compatible Storage**: Files stored in cloud storage using Supabase AWS S3 (our standard for production)

## Quick Configuration Guide

### Local Storage (Development)

To use local storage during development:

1. Set `USE_S3_IN_DEV=false` in your `.env` file
2. That's it! Files will be stored locally in the directories specified in your collection configuration

### Supabase AWS S3 Storage (Production or Development)

We use Supabase AWS S3 as our standard storage solution:

1. Create a new bucket in your Supabase project if not existing and get all the necessary credentials.
   * Supabase Project URL (for storage endpoint) -> `S3_ENDPOINT`
   * Supabase S3 Access Key ID -> `S3_ACCESS_KEY_ID`
   * Supabase S3 Secret Access Key -> `S3_SECRET_ACCESS_KEY`
   * Supabase Bucket Name -> `S3_BUCKET`
   * Supabase Bucket Region -> `S3_REGION`

2. Configure your `.env` file:

```dotenv
# Enable S3 in development (optional)
USE_S3_IN_DEV=true

# S3 configuration
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
S3_REGION=your_region
S3_BUCKET=your_bucket_name
S3_ENDPOINT=https://your-endpoint.com
```

## Adding a New Collection with Storage Support

1. **Create your collection file** in `src/collections/` with the `upload` field type:

```typescript
import { CollectionConfig } from 'payload/types'

export const Documents: CollectionConfig = {
  slug: 'documents',
  upload: {
    staticURL: '/documents',
    staticDir: 'documents',
    mimeTypes: ['application/pdf'],
  },
  fields: [
    // Your fields
  ],
}
```

2. **Update the S3 storage configuration** in `src/plugins/index.ts`:

```typescript
s3Storage({
  enabled: useCloudStorage,
  collections: {
    media: {
      disableLocalStorage: true,
      prefix: 'media',
    },
    documents: {  // Your new collection that uses upload
      disableLocalStorage: true,
      prefix: 'documents',
    },
  },
  bucket: process.env.S3_BUCKET || '',
  config: {
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
    region: process.env.S3_REGION || '',
    endpoint: process.env.S3_ENDPOINT,
  },
})
```

3. **Import and add your collection** to `payload.config.ts`:

```typescript
import { Documents } from './collections/Documents'

// Add to collections array
collections: [Pages, Posts, Media, Categories, Users, Clinics, Doctors, Documents],
```

**Note:** Only collections that use the `upload` field type need to be included in the S3 storage configuration.
