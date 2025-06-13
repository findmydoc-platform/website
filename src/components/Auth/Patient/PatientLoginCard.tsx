import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PatientLoginForm } from './PatientLoginForm'

export function PatientLoginCard() {
  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Patient Login</CardTitle>
          <CardDescription className="text-center">
            Sign in to your patient account to access your medical information
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <PatientLoginForm />
        </CardContent>
      </Card>
    </div>
  )
}
