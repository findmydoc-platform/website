import { randomUUID } from 'node:crypto'
import type { PayloadRequest, Where } from 'payload'
import {
  deletionEligible,
  metadataRetentionMilliseconds,
  needsScrubbing,
  outgoingTerminalStates,
  transientFields,
} from './retentionPolicy'
import { workerTransaction } from './workerStorage'

export async function sweepTransactionalEmail(req: PayloadRequest, environment: string, now: () => number) {
  const authority = { kind: 'sweep' as const, token: randomUUID(), now }
  // Content removal precedes metadata deletion, including when a retained backlog exists.
  for (const phase of ['scrub', 'delete'] as const) {
    let afterId = 0
    while (true) {
      const eligible: Where =
        phase === 'scrub'
          ? {
              or: [
                {
                  and: [
                    { state: { in: outgoingTerminalStates } },
                    {
                      or: [
                        { scrubbedAt: { exists: false } },
                        ...Object.keys(transientFields).map((field) => ({ [field]: { exists: true } })),
                      ],
                    },
                  ],
                },
                {
                  and: [
                    { state: { in: ['queued', 'prepared'] } },
                    {
                      or: [
                        { deliveryDeadline: { less_than: new Date(now()).toISOString() } },
                        { deliveryDeadline: { exists: false } },
                        { firstAmbiguousAt: { less_than: new Date(now() - 86_400_000).toISOString() } },
                      ],
                    },
                  ],
                },
              ],
            }
          : {
              and: [
                { state: { in: outgoingTerminalStates } },
                { scrubbedAt: { exists: true } },
                { terminalAt: { less_than_equal: new Date(now() - metadataRetentionMilliseconds).toISOString() } },
              ],
            }
      const records = await workerTransaction(req, authority, (storage) =>
        storage.find({
          and: [{ runtimeEnvironment: { equals: environment } }, { id: { greater_than: afterId } }, eligible],
        }),
      )
      if (!records.length) break
      for (const candidate of records) {
        await workerTransaction(req, authority, async (storage) => {
          const [record] = await storage.find({ id: { equals: candidate.id } })
          if (!record) return
          if (phase === 'delete') {
            if (deletionEligible(record, now())) await storage.remove(record)
            return
          }
          if (!needsScrubbing(record, now())) return
          const timestamp = new Date(now()).toISOString()
          const terminal = outgoingTerminalStates.includes(record.state)
          await storage.write(
            record,
            {
              ...transientFields,
              state: terminal ? record.state : 'expired',
              terminalAt: record.terminalAt ?? timestamp,
              scrubbedAt: timestamp,
            },
            [
              ...(terminal ? [] : [{ type: 'delivery.expired' as const, outcomeCode: 'expired' as const }]),
              { type: 'payload.scrubbed' },
            ],
          )
        })
        afterId = candidate.id
      }
    }
  }
}
