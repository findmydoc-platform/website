import { generatePostMetadata, renderPost, type PostPageArgs } from './postDetail'

export const dynamic = 'force-dynamic'

export default function PostPage(args: PostPageArgs) {
  return renderPost(args, 'de')
}

export function generateMetadata(args: PostPageArgs) {
  return generatePostMetadata(args, 'de')
}
