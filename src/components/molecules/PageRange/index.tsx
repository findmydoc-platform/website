import React from 'react'

const defaultLabels = {
  plural: 'Docs',
  singular: 'Doc',
}

const defaultCollectionLabels = {
  posts: {
    plural: 'Posts',
    singular: 'Post',
  },
}

export const PageRange: React.FC<{
  className?: string
  collection?: keyof typeof defaultCollectionLabels
  collectionLabels?: {
    plural?: string
    singular?: string
  }
  currentPage?: number
  limit?: number
  totalDocs?: number
}> = (props) => {
  const { className, collection, collectionLabels: collectionLabelsFromProps, currentPage, limit, totalDocs } = props
  const resolvedCurrentPage = currentPage ?? 1
  const resolvedLimit = limit ?? 1

  let indexStart = (resolvedCurrentPage - 1) * resolvedLimit + 1
  if (totalDocs && indexStart > totalDocs) indexStart = 0

  let indexEnd = resolvedCurrentPage * resolvedLimit
  if (totalDocs && indexEnd > totalDocs) indexEnd = totalDocs

  const { plural, singular } =
    collectionLabelsFromProps || (collection ? defaultCollectionLabels[collection] : undefined) || defaultLabels || {}

  return (
    <div className={[className, 'font-semibold'].filter(Boolean).join(' ')}>
      {(typeof totalDocs === 'undefined' || totalDocs === 0) && 'Search produced no results.'}
      {typeof totalDocs !== 'undefined' &&
        totalDocs > 0 &&
        `Showing ${indexStart}${indexStart > 0 ? ` - ${indexEnd}` : ''} of ${totalDocs} ${
          totalDocs > 1 ? plural : singular
        }`}
    </div>
  )
}
