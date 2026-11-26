import { generatePostMetadata, renderPost, type PostPageArgs } from '@/app/(frontend)/posts/[slug]/postDetail'

export const dynamic = 'force-dynamic'

export default function EnglishPostPage(args: PostPageArgs) {
  return renderPost(args, 'en')
}

export function generateMetadata(args: PostPageArgs) {
  return generatePostMetadata(args, 'en')
}
