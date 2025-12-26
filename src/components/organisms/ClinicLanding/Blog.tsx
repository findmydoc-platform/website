import React from 'react'

import { Button } from '@/components/atoms/button'
import { Container } from '@/components/molecules/Container'
import { clinicBlogData } from '@/stories/fixtures/clinics'
import { BlogCard } from '@/components/organisms/BlogCard'

export const ClinicBlog: React.FC = () => {
  return (
    <section className="bg-white py-20">
      <Container>
        <div className="mb-16">
          <h2 className="mb-6 text-5xl font-bold text-foreground">Blog</h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {clinicBlogData.map((post, index) => (
            <BlogCard
              key={index}
              title={post.title}
              excerpt={post.excerpt}
              dateLabel={post.date}
              image={{
                src: post.image,
                alt: post.title,
              }}
            />
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <Button
            variant="outline"
            className="rounded-lg border-primary text-primary hover:bg-primary hover:text-white"
          >
            More News
          </Button>
        </div>
      </Container>
    </section>
  )
}
