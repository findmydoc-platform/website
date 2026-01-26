import React from 'react'
import Image from 'next/image'
import { Facebook, Instagram, Twitter } from 'lucide-react'

import { Container } from '@/components/molecules/Container'

type LandingTeamMember = {
  name: string
  role: string
  image: string
  socials: {
    facebook?: string
    twitter?: string
    instagram?: string
  }
}

type LandingTeamProps = {
  team: LandingTeamMember[]
}

export const LandingTeam: React.FC<LandingTeamProps> = ({ team }) => {
  return (
    <section className="bg-white py-20">
      <Container>
        <div className="mb-16 text-center">
          <h2 className="text-foreground mb-6 text-5xl font-bold">Our Team</h2>
          <p className="text-foreground/80 mx-auto max-w-2xl text-xl">
            Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {team.map((member, index) => (
            <div key={index} className="flex flex-col items-center">
              <div className="relative mb-6 h-[28rem] w-full overflow-hidden rounded-3xl">
                <Image src={member.image} alt={member.name} fill className="object-cover" />
              </div>

              <div className="relative -mt-20 w-[80%] rounded-3xl bg-white p-6 shadow-lg">
                <h3 className="text-foreground mb-2 text-center text-2xl font-bold">{member.name}</h3>
                <p className="text-muted-foreground mb-4 text-center">{member.role}</p>

                <div className="flex justify-center space-x-4">
                  <a href={member.socials.facebook} className="text-foreground hover:text-primary transition-colors">
                    <Facebook className="h-5 w-5" />
                  </a>
                  <a href={member.socials.twitter} className="text-foreground hover:text-primary transition-colors">
                    <Twitter className="h-5 w-5" />
                  </a>
                  <a href={member.socials.instagram} className="text-foreground hover:text-primary transition-colors">
                    <Instagram className="h-5 w-5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <button className="border-secondary/30 text-secondary hover:bg-secondary rounded-lg border px-8 py-3 transition-colors hover:text-white">
            Learn More
          </button>
        </div>
      </Container>
    </section>
  )
}
