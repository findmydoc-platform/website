import type { Meta, StoryObj } from '@storybook/react-vite'
import { Container } from '@/components/molecules/Container'
import { BlogHero } from '@/components/organisms/Blog/BlogHero'
import { BlogCard } from '@/components/organisms/Blog/BlogCard'
import { PageRange } from '@/components/molecules/PageRange'
import { Pagination } from '@/components/molecules/Pagination'
import { collectionPosts } from '@/stories/organisms/fixtures'
import authorAvatar from '../assets/doctor-portrait.jpg'
import type { BlogCardBaseProps } from '@/utilities/blog/normalizePost'
import { withViewportStory } from '../utils/viewportMatrix'

const meta: Meta = {
  title: 'Domain/Blog/Templates/BlogListing',
  tags: ['autodocs', 'domain:blog', 'layer:template', 'status:stable', 'used-in:route:/posts'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

// Extended mock data for the listing page (6 posts total)
const extendedPosts: BlogCardBaseProps[] = [
  {
    ...collectionPosts[0],
    title: 'Die Zukunft der Zahnmedizin: KI und digitale Diagnostik',
    excerpt: 'Moderne Technologien revolutionieren die zahnärztliche Versorgung und ermöglichen präzisere Diagnosen.',
    category: 'Zahnmedizin',
    author: {
      name: 'Dr. Sarah Weber',
      avatar: typeof authorAvatar === 'string' ? authorAvatar : authorAvatar.src,
    },
    dateLabel: '15. Januar 2026',
    readTime: '8 Min. Lesezeit',
  } as BlogCardBaseProps,
  {
    ...collectionPosts[1],
    title: 'Hautpflege im Winter: Expertentipps für gesunde Haut',
    excerpt: 'Dermatologische Empfehlungen für die kalte Jahreszeit und ihre besonderen Herausforderungen.',
    category: 'Dermatologie',
    author: {
      name: 'Dr. Michael Klein',
      avatar: typeof authorAvatar === 'string' ? authorAvatar : authorAvatar.src,
    },
    dateLabel: '12. Januar 2026',
    readTime: '6 Min. Lesezeit',
  } as BlogCardBaseProps,
  {
    ...collectionPosts[2],
    title: 'Orthopädische Rehabilitation nach Sportverletzungen',
    excerpt: 'Effektive Therapieansätze für eine schnelle und nachhaltige Genesung bei Sportverletzungen.',
    category: 'Orthopädie',
    author: {
      name: 'Dr. Anna Müller',
      avatar: typeof authorAvatar === 'string' ? authorAvatar : authorAvatar.src,
    },
    dateLabel: '8. Januar 2026',
    readTime: '10 Min. Lesezeit',
  } as BlogCardBaseProps,
  {
    ...collectionPosts[0],
    title: 'Ernährung und psychische Gesundheit: Der Zusammenhang',
    excerpt: 'Wissenschaftliche Erkenntnisse über den Einfluss der Ernährung auf unser mentales Wohlbefinden.',
    category: 'Ernährung',
    author: {
      name: 'Dr. Thomas Schmidt',
      avatar: typeof authorAvatar === 'string' ? authorAvatar : authorAvatar.src,
    },
    dateLabel: '5. Januar 2026',
    readTime: '7 Min. Lesezeit',
  } as BlogCardBaseProps,
  {
    ...collectionPosts[1],
    title: 'Präventive Kardiologie: Herzgesundheit langfristig sichern',
    excerpt: 'Moderne Ansätze zur Vorbeugung von Herz-Kreislauf-Erkrankungen durch gezielte Maßnahmen.',
    category: 'Kardiologie',
    author: {
      name: 'Dr. Lisa Bauer',
      avatar: typeof authorAvatar === 'string' ? authorAvatar : authorAvatar.src,
    },
    dateLabel: '2. Januar 2026',
    readTime: '9 Min. Lesezeit',
  } as BlogCardBaseProps,
]

export const Default: StoryObj = {
  render: () => {
    const featuredPost = extendedPosts[0]!
    const gridPosts = extendedPosts.slice(1)

    return (
      <div className="flex min-h-screen flex-col">
        {/* Blog Hero Section */}
        <BlogHero
          title="Our Blog"
          subtitle="Explore expert articles, health tips, and current medical topics from our team."
        />

        {/* Main Content */}
        <Container className="py-12 md:py-16">
          {/* Page Range */}
          <PageRange currentPage={1} totalDocs={24} limit={12} />

          {/* Featured Post - Large Overlay Card */}
          <div className="mb-8 md:mb-12">
            <BlogCard.Overlay {...featuredPost} />
          </div>

          {/* Grid of Posts */}
          <div className="grid gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
            {gridPosts.map((post, index) => (
              <BlogCard.Simple key={index} {...post} />
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-12 md:mt-16">
            <Pagination page={1} totalPages={2} />
          </div>
        </Container>
      </div>
    )
  },
}

export const WithoutFeaturedPost: StoryObj = {
  render: () => (
    <div className="flex min-h-screen flex-col">
      <BlogHero
        title="Our Blog"
        subtitle="Explore expert articles, health tips, and current medical topics from our team."
      />

      <Container className="py-12 md:py-16">
        <PageRange currentPage={1} totalDocs={24} limit={12} />

        {/* Grid of Posts - No Featured */}
        <div className="grid gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {extendedPosts.map((post, index) => (
            <BlogCard.Simple key={index} {...post} />
          ))}
        </div>

        <div className="mt-12 md:mt-16">
          <Pagination page={1} totalPages={2} />
        </div>
      </Container>
    </div>
  ),
}

export const SecondPage: StoryObj = {
  render: () => (
    <div className="flex min-h-screen flex-col">
      <BlogHero
        title="Our Blog"
        subtitle="Explore expert articles, health tips, and current medical topics from our team."
      />

      <Container className="py-12 md:py-16">
        <PageRange currentPage={2} totalDocs={24} limit={12} />

        {/* Grid Only - No Featured on Page 2+ */}
        <div className="grid gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {extendedPosts.map((post, index) => (
            <BlogCard.Simple key={index} {...post} />
          ))}
        </div>

        <div className="mt-12 md:mt-16">
          <Pagination page={2} totalPages={2} />
        </div>
      </Container>
    </div>
  ),
}

export const Default320: StoryObj = withViewportStory(Default, 'public320', 'Default / 320')
export const Default375: StoryObj = withViewportStory(Default, 'public375', 'Default / 375')
export const Default640: StoryObj = withViewportStory(Default, 'public640', 'Default / 640')
export const Default768: StoryObj = withViewportStory(Default, 'public768', 'Default / 768')
export const Default1024: StoryObj = withViewportStory(Default, 'public1024', 'Default / 1024')
export const Default1280: StoryObj = withViewportStory(Default, 'public1280', 'Default / 1280')
export const SecondPage320: StoryObj = withViewportStory(SecondPage, 'public320', 'Second page / 320')
export const SecondPage375: StoryObj = withViewportStory(SecondPage, 'public375', 'Second page / 375')
export const SecondPage640: StoryObj = withViewportStory(SecondPage, 'public640', 'Second page / 640')
export const SecondPage768: StoryObj = withViewportStory(SecondPage, 'public768', 'Second page / 768')
export const SecondPage1024: StoryObj = withViewportStory(SecondPage, 'public1024', 'Second page / 1024')
export const SecondPage1280: StoryObj = withViewportStory(SecondPage, 'public1280', 'Second page / 1280')
