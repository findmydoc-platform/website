import type { Payload } from 'payload';

// Slug-bearing collections we commonly clean up in tests
export type TestCollectionSlug = 'pages' | 'posts' | 'categories' | 'clinics' | 'treatments' | 'tags' | 'doctors';

/**
 * Deletes all entities with a test slug prefix from the given collection.
 * Note: Only works for collections that have a `slug` field.
 * @param payload Payload instance
 * @param collection Collection slug (must support `slug`)
 * @param slugPrefix Slug prefix to match (e.g., "test-foo")
 */
export async function cleanupTestEntities(
  payload: Payload,
  collection: TestCollectionSlug,
  slugPrefix: string,
) {
  const { docs } = await payload.find({
    // Cast to satisfy typed Payload API in tests
    collection: collection as any,
    where: { slug: { like: `${slugPrefix}%` } },
    limit: 100,
    overrideAccess: true,
  });

  for (const doc of docs) {
    await payload.delete({ collection: collection as any, id: doc.id, overrideAccess: true });
  }
}
