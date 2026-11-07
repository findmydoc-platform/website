import { createLocalReq, getPayload } from 'payload'
import config from '../src/payload.config'
import { createClinicFixture } from '../tests/fixtures/createClinicFixture'
import { createTransactionalEmailWorker } from '../src/features/transactionalEmail/worker'

const payload = await getPayload({ config })
try {
  const [command, id] = process.argv.slice(2)
  let result: unknown
  if (command === 'create') {
    const city = (await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })).docs[0]!
    const fixture = await createClinicFixture(payload, city.id, {
      slugPrefix: `preparation-browser${id ? `-${id}` : ''}`,
    })
    await payload.update({
      collection: 'clinics',
      id: fixture.clinic.id,
      data: { status: 'approved' },
      overrideAccess: true,
    })
    result = {
      id: fixture.clinic.id,
      slug: fixture.clinic.slug,
      name: fixture.clinic.name,
      doctorId: fixture.doctor.id,
    }
  } else if (command === 'worker') {
    const worker = createTransactionalEmailWorker(await createLocalReq({}, payload), {
      suppression: async () => 'cleared',
    })
    for (const candidate of await worker.candidatesForBatch(0)) await worker.run(String(candidate))
    result = { completed: true }
  } else if ((command === 'approved' || command === 'pending') && id) {
    await payload.update({ collection: 'clinics', id: Number(id), data: { status: command }, overrideAccess: true })
    result = { completed: true }
  } else if (command === 'count' && id) {
    result = await payload.count({
      collection: 'patientClinicInquiries',
      where: { clinic: { equals: Number(id) } },
      overrideAccess: true,
    })
  } else throw new Error('Unknown isolated browser fixture command.')
  console.log(JSON.stringify(result))
} finally {
  await payload.destroy()
}

process.exit(0)
