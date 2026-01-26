import { PatientRegistrationForm } from '@/components/organisms/Auth/PatientRegistrationForm'

export default async function PatientRegistrationPage() {
  return (
    <div className="my-12 flex flex-col items-center justify-center gap-6 p-6 md:p-10">
      <PatientRegistrationForm />
    </div>
  )
}
