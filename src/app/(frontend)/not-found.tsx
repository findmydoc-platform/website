import Link from 'next/link'
import React from 'react'

import { Button } from '@/components/atoms/button'
import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'

export default function NotFound() {
  return (
    <Container className="py-28">
      <div className="prose max-w-none">
        <Heading as="h1" align="left" className="mb-0">
          404
        </Heading>
        <p className="mb-4">This page could not be found.</p>
      </div>
      <Button asChild variant="default">
        <Link href="/">Go home</Link>
      </Button>
    </Container>
  )
}
