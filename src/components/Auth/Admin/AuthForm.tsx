'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from './LoginForm'

export default function AuthForm() {
  const [activeTab, setActiveTab] = useState('login')

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">{'Staff Login'}</CardTitle>
          <CardDescription className="text-center">
            {'Sign in to your account to continue'}
          </CardDescription>
        </CardHeader>
        <Tabs
          defaultValue="login"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}
