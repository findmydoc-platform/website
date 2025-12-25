import React from 'react'
import Image from 'next/image'

import { Button } from '@/components/atoms/button'
import { Container } from '@/components/molecules/Container'
import { clinicBlogData } from '@/stories/fixtures/clinics'

export const ClinicBlog: React.FC = () => {
  return (
    <section className="bg-white py-20">
      <Container>
        <div className="mb-16">
          <h2 className="mb-6 text-5xl font-bold text-foreground">Blog</h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {clinicBlogData.map((post, index) => (
            <div key={index} className="flex flex-col">
              <div className="relative mb-6 h-[292px] overflow-hidden rounded-[40px]">
                <Image
                  src={post.image}
                  alt={post.title}
                  fill
                  className="object-cover transition-transform duration-300 hover:scale-105"
                />
              </div>
              <div className="mb-2 text-sm text-muted-foreground">{post.date}</div>
              <h3 className="mb-4 text-3xl font-bold leading-tight text-foreground">{post.title}</h3>
              <p className="mb-4 text-lg text-muted-foreground">{post.excerpt}</p>
            </div>
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
