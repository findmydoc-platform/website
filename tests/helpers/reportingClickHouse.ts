import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

type SyntheticReportingEvent = {
  timestamp: string
  event: string
  distinct_id: string
  properties: { clinic_id: string; $session_id?: string; submission_id?: string }
}

/** Execute the unchanged adapter query against isolated synthetic source rows. */
export function executeReportingQuery(query: string, events: SyntheticReportingEvent[]) {
  const container = process.env.REPORTING_CLICKHOUSE_CONTAINER
  if (!container) throw new Error('REPORTING_CLICKHOUSE_CONTAINER is required')
  const database = `reporting_${process.pid}_${randomUUID().replaceAll('-', '')}`
  const run = (sql: string, input?: string) =>
    execFileSync(
      'docker',
      [
        'exec',
        '-i',
        container,
        'clickhouse-client',
        '--multiquery',
        '--date_time_input_format',
        'best_effort',
        '--query',
        sql,
      ],
      { encoding: 'utf8', input },
    )
  run(`CREATE DATABASE ${database}`)
  try {
    run(
      `CREATE TABLE ${database}.events (timestamp DateTime64(3, 'UTC'), event String, distinct_id String, properties Tuple(clinic_id String, \`$session_id\` String, submission_id String)) ENGINE = Memory`,
    )
    if (events.length)
      run(
        `INSERT INTO ${database}.events FORMAT JSONEachRow`,
        events
          .map((event) =>
            JSON.stringify({ ...event, properties: { $session_id: '', submission_id: '', ...event.properties } }),
          )
          .join('\n'),
      )
    const output = JSON.parse(run(`USE ${database}; ${query} FORMAT JSONCompact`)) as {
      meta: { name: string }[]
      data: number[][]
    }
    return { columns: output.meta.map((column) => column.name), results: output.data }
  } finally {
    run(`DROP DATABASE ${database}`)
  }
}
