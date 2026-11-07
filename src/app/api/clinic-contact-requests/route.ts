import config from '@payload-config'
import { createLocalReq, getPayload } from 'payload'
import { preparationPostHandler } from '@/endpoints/inquiryPreparations'

/** Anonymous contact requests require explicit account authorization before private preparation. */
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const req = await createLocalReq({ req: { headers: request.headers, url: request.url } }, payload)
  req.json = () => request.json()
  return preparationPostHandler(req)
}
