import { sql, type PostgresAdapterArgs } from '@payloadcms/db-postgres'
import { uniqueIndex } from '@payloadcms/db-postgres/drizzle/pg-core'

// Payload's native schema hook keeps the partial index in generated migration snapshots.
export const transactionalEmailEventSchema: NonNullable<PostgresAdapterArgs['afterSchemaInit']>[number] = ({
  schema,
  extendTable,
}) => {
  const table = schema.tables.transactional_email_events
  if (!table) throw new Error('Transactional email event table missing from Payload schema')
  extendTable({
    table,
    extraConfig: (table) => ({
      providerIdentity: uniqueIndex('transactional_email_events_provider_event_id_idx')
        .on(table.providerEventId)
        .where(sql`${table.providerEventId} IS NOT NULL AND ${table.providerEventId} <> ''`),
    }),
  })
  return schema
}
