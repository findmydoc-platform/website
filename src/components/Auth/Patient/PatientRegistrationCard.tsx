'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PatientRegistrationForm } from './PatientRegistrationForm'

export default function PatientRegistrationCard() {
  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Create Patient Account</CardTitle>
          <CardDescription className="text-center">
            Join findmydoc to search for clinics and treatments
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <PatientRegistrationForm />
        </CardContent>
      </Card>
    </div>
  )
}
