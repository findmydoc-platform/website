import React, { useEffect } from 'react'
import { toast } from '@payloadcms/ui'
import type { Decorator } from '@storybook/react-vite'

export const MockToastDecorator: Decorator = (Story) => {
  useEffect(() => {
    // Store original methods
    const originalSuccess = toast.success
    const originalError = toast.error
    const originalWarning = toast.warning
    const originalInfo = toast.info

    // Mock methods to prevent side effects and errors during stories
    // We return a string ID as the real toast usually does
    toast.success = () => 'mock-toast-id'
    toast.error = () => 'mock-toast-id'
    toast.warning = () => 'mock-toast-id'
    toast.info = () => 'mock-toast-id'

    // Cleanup to restore original implementation
    return () => {
      toast.success = originalSuccess
      toast.error = originalError
      toast.warning = originalWarning
      toast.info = originalInfo
    }
  }, [])

  return <Story />
}
