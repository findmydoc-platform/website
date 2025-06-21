import { redirect } from 'next/navigation'
import { hasAdminUsers } from '@/auth/utilities/firstAdminCheck'
import { BaseRegistrationForm } from '@/components/Auth/BaseRegistrationForm'

export default async function FirstAdminSetupPage() {
  const adminUsersExist = await hasAdminUsers()

  if (adminUsersExist) {
    redirect('/admin/login')
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <BaseRegistrationForm
        title="Create First Admin User"
        description="Set up your platform administrator account"
        apiEndpoint="/api/auth/first-admin"
        successRedirect="/admin"
        submitButtonText="Create Admin User"
        fields={[
          {
            name: 'firstName',
            label: 'First Name',
            type: 'text',
            placeholder: 'John',
            required: true,
            gridCol: '2',
          },
          {
            name: 'lastName',
            label: 'Last Name',
            type: 'text',
            placeholder: 'Doe',
            required: true,
            gridCol: '2',
          },
          {
            name: 'email',
            label: 'Email',
            type: 'email',
            placeholder: 'admin@example.com',
            required: true,
          },
          { name: 'password', label: 'Password', type: 'password', required: true, minLength: 6 },
          {
            name: 'confirmPassword',
            label: 'Confirm Password',
            type: 'password',
            required: true,
            minLength: 6,
          },
        ]}
      />
    </div>
  )
}
