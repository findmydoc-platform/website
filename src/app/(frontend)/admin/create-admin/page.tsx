import { CreateAdminForm } from '@/components/Admin/CreateAdminForm'

export default async function CreatePlatformAdminPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
          Create Platform Admin
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Add a new administrator to the platform
        </p>
        <CreateAdminForm />
      </div>
    </div>
  )
}
