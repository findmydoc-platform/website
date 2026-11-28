'use client'

import { Button } from '@/components/atoms/button'
import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import { usePublicErrorCopy } from './_components/PublicErrorCopyProvider.client'

export default function FrontendError({ retry }: { retry: () => void }) {
  const { locale, copy } = usePublicErrorCopy()
  return (
    <Container className="space-y-4 py-16 sm:py-28" lang={locale}>
      <Heading as="h1" align="left">
        {copy?.unexpected}
      </Heading>
      <Button variant="default" onClick={retry}>
        {copy?.retry}
      </Button>
    </Container>
  )
}
