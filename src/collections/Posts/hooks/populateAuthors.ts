import type { CollectionAfterReadHook } from 'payload'
import type { PlatformStaff, BasicUser } from 'src/payload-types'

// The `staff` collection has access control locked so that users are not publicly accessible
// This means that we need to populate the authors manually here to protect user privacy
// GraphQL will not return mutated user data that differs from the underlying schema
// So we use an alternative `populatedAuthors` field to populate the user data, hidden from the admin UI
export const populateAuthors: CollectionAfterReadHook = async ({ doc, req, req: { payload } }) => {
  if (doc?.authors) {
    const authorDocs: PlatformStaff[] = []

    for (const author of doc.authors) {
      const authorDoc = await payload.findByID({
        id: typeof author === 'object' ? author?.id : author,
        collection: 'platformStaff',
        depth: 0,
        req,
      })

      if (authorDoc) {
        authorDocs.push(authorDoc)
      }
    }

    doc.populatedAuthors = []
    for (const authorDoc of authorDocs) {
      // Fetch linked BasicUser to get centralized name fields
      let name = 'Unknown Author'
      try {
        if (authorDoc.user) {
          const userId = typeof authorDoc.user === 'object' ? authorDoc.user.id : authorDoc.user
          const basicUser = (await payload.findByID({
            collection: 'basicUsers',
            id: userId,
            depth: 0,
            req,
          })) as BasicUser
          if (basicUser?.firstName && basicUser?.lastName) {
            name = `${basicUser.firstName} ${basicUser.lastName}`
          }
        }
      } catch (_e) {
        // swallow - keep fallback name
      }
      doc.populatedAuthors.push({ id: authorDoc.id, name })
    }
  }

  return doc
}
