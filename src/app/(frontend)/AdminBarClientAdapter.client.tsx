'use client'

import { useRouter } from 'next/navigation'

import { AdminBar } from '@/components/organisms/AdminBar'

export function AdminBarClientAdapter({ preview }: { preview: boolean }) {
  const router = useRouter()

  const onPreviewExit = async () => {
    await fetch('/next/exit-preview')
    router.push('/')
    router.refresh()
  }

  return <AdminBar adminBarProps={{ preview }} onPreviewExit={onPreviewExit} />
}
