import React from 'react'
import Image from 'next/image'
import { Facebook, Github, Instagram, Linkedin, Twitter } from 'lucide-react'

import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'

type LandingTeamMember = {
  name: string
  role: string
  image: string
  socials?: {
    facebook?: string
    twitter?: string
    instagram?: string
    linkedin?: string
    github?: string
  }
}

type LandingTeamProps = {
  team: LandingTeamMember[]
  title: string
  description: string
}

export const LandingTeam: React.FC<LandingTeamProps> = ({ team, title, description }) => {
  return (
    <section className="bg-white py-20">
      <Container>
        <SectionHeading className="mb-16" title={title} description={description} size="section" align="center" />

        <div className="grid gap-8 md:grid-cols-3">
          {team.map((member, index) => (
            <div key={index} className="flex flex-col items-center">
              {/* Using an arbitrary aspect ratio here to force a more horizontal photo crop as required by the design. */}
              <div className="relative aspect-[3/4] min-h-[28rem] w-full overflow-hidden rounded-3xl md:min-h-[34rem]">
                <Image
                  src={member.image}
                  alt={member.name}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover"
                />

                <div className="absolute inset-x-6 bottom-6 rounded-3xl bg-white/95 p-6 shadow-lg backdrop-blur">
                  <h3 className="mb-2 text-center text-2xl font-bold text-foreground">{member.name}</h3>
                  <p className="mb-4 text-center text-muted-foreground">{member.role}</p>

                  {(() => {
                    const socialItems = [
                      { href: member.socials?.facebook, Icon: Facebook, label: 'Facebook' },
                      { href: member.socials?.twitter, Icon: Twitter, label: 'Twitter' },
                      { href: member.socials?.instagram, Icon: Instagram, label: 'Instagram' },
                      { href: member.socials?.linkedin, Icon: Linkedin, label: 'LinkedIn' },
                      { href: member.socials?.github, Icon: Github, label: 'GitHub' },
                    ].filter((item) => Boolean(item.href))

                    if (socialItems.length === 0) return null

                    return (
                      <div className="flex justify-center gap-4">
                        {socialItems.map(({ href, Icon, label }) => (
                          <a
                            key={label}
                            href={href}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label={label}
                            className="text-foreground transition-colors hover:text-primary"
                          >
                            <Icon className="h-5 w-5" />
                          </a>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <button className="rounded-lg border border-secondary/30 px-8 py-3 text-secondary transition-colors hover:bg-secondary hover:text-white">
            Learn More
          </button>
        </div>
      </Container>
    </section>
  )
}
