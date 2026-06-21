import type { Metadata } from 'next'

import type { IndexingPolicyResult } from './routePolicies'

export type IndexingMetadata = Pick<Metadata, 'alternates' | 'robots'>

export function buildIndexingMetadata(policy: IndexingPolicyResult): IndexingMetadata {
  return {
    alternates: {
      canonical: policy.canonicalPath,
    },
    ...(policy.robots ? { robots: policy.robots } : {}),
  }
}
