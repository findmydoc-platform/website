'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface CreateAdminFormData {
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'support' | 'content-manager'
}

interface CreateAdminResponse {
  success: boolean
  message: string
  admin?: {
    id: number
    email: string
    firstName: string
    lastName: string
    role: string
    tempPassword: string
  }
  error?: string
  details?: any
}

export function CreateAdminForm() {
  const [formData, setFormData] = useState<CreateAdminFormData>({
    email: '',
    firstName: '',
    lastName: '',
    role: 'admin',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<CreateAdminResponse | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/create-platform-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data: CreateAdminResponse = await response.json()
      setResult(data)

      if (data.success) {
        // Reset form on success
        setFormData({
          email: '',
          firstName: '',
          lastName: '',
          role: 'admin',
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Network error. Please try again.',
        error: 'Failed to submit request',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof CreateAdminFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create Platform Admin</CardTitle>
        <CardDescription>
          Create a new platform administrator account. A temporary password will be generated.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="admin@example.com"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="John"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Doe"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={formData.role}
              onValueChange={(value) =>
                handleInputChange('role', value as CreateAdminFormData['role'])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="content-manager">Content Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Creating Admin...' : 'Create Admin'}
          </Button>
        </form>

        {result && (
          <div className="mt-4">
            {result.success ? (
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">
                  <div className="space-y-2">
                    <p className="font-medium">{result.message}</p>
                    {result.admin && (
                      <div className="text-sm">
                        <p>
                          <strong>Email:</strong> {result.admin.email}
                        </p>
                        <p>
                          <strong>Name:</strong> {result.admin.firstName} {result.admin.lastName}
                        </p>
                        <p>
                          <strong>Role:</strong> {result.admin.role}
                        </p>
                        <p>
                          <strong>Temporary Password:</strong>{' '}
                          <code className="bg-white px-1 py-0.5 rounded">
                            {result.admin.tempPassword}
                          </code>
                        </p>
                        <p className="text-xs text-green-600 mt-2">
                          Please share these credentials securely with the new admin.
                        </p>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">
                  <p className="font-medium">{result.error || result.message}</p>
                  {result.details && (
                    <pre className="text-xs mt-2 overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
