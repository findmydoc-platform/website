import { PatientRegistrationForm } from '@/components/Auth/PatientRegistrationForm'

export default async function PatientRegistrationPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 md:p-10">
      <PatientRegistrationForm />
    </div>
  )
}
