'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FirstAdminRegistrationForm } from './FirstAdminRegistrationForm'

export default function FirstAdminForm() {
  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Create First Admin User</CardTitle>
          <CardDescription className="text-center">
            Set up your platform administrator account
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <FirstAdminRegistrationForm />
        </CardContent>
      </Card>
    </div>
  )
}
