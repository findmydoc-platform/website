import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const expectedFunction = {
  schema: 'auth_mail_suppression',
  name: 'send_email_v1',
  argument: { name: 'event', type: 'jsonb' },
  returns: 'jsonb',
  language: 'sql',
  security: 'invoker',
  searchPath: [],
  body: "select '{}'::jsonb;",
}

const expectedPermissions = {
  schema: { usage: ['supabase_auth_admin'], create: [] },
  function: { execute: ['supabase_auth_admin'] },
  revoked: ['PUBLIC', 'anon', 'authenticated'],
  grantOption: false,
}

const expectedMigration = `begin;
create schema auth_mail_suppression;
create function auth_mail_suppression.send_email_v1(event jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select '{}'::jsonb;
$function$;
revoke all on schema auth_mail_suppression from public, anon, authenticated;
grant usage on schema auth_mail_suppression to supabase_auth_admin;
revoke all on function auth_mail_suppression.send_email_v1(jsonb) from public, anon, authenticated;
grant execute on function auth_mail_suppression.send_email_v1(jsonb) to supabase_auth_admin;
commit;`

function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

/** Fingerprints cover configuration only. No hook event or runtime credentials enter this function. */
export function suppressionFingerprint(value) {
  return createHash('sha256').update(canonicalJSON(value)).digest('hex')
}

function exactKeys(value, keys) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === [...keys].sort().join(',')
  )
}

/** Validate desired repository state. Success supplies no hosted binding or activation evidence. */
export function validateSuppressionDeclaration(value) {
  if (value === undefined || value === null) return { ok: false, issues: ['missing-declaration'] }
  try {
    if (
      !exactKeys(value, ['version', 'migration', 'function', 'permissions', 'fingerprints']) ||
      value.version !== 1 ||
      !/^migrations\/\d{14}_native_mail_suppression\.sql$/u.test(value.migration) ||
      !exactKeys(value.fingerprints, ['function', 'permissions'])
    ) {
      return { ok: false, issues: ['invalid-declaration'] }
    }
    const issues = []
    if (canonicalJSON(value.function) !== canonicalJSON(expectedFunction)) issues.push('unexpected-function')
    if (canonicalJSON(value.permissions) !== canonicalJSON(expectedPermissions)) issues.push('unexpected-permissions')
    if (value.fingerprints.function !== suppressionFingerprint(value.function))
      issues.push('function-fingerprint-mismatch')
    if (value.fingerprints.permissions !== suppressionFingerprint(value.permissions))
      issues.push('permission-fingerprint-mismatch')
    if (issues.length) return { ok: false, issues }
    return {
      ok: true,
      fingerprints: { function: value.fingerprints.function, permissions: value.fingerprints.permissions },
    }
  } catch {
    return { ok: false, issues: ['invalid-declaration'] }
  }
}

/** The closed migration contract disallows extra dependencies, statements, logging, or network calls. */
export function validateSuppressionMigration(sql) {
  if (typeof sql !== 'string' || sql.trim().replace(/\s+/gu, ' ') !== expectedMigration.replace(/\s+/gu, ' ')) {
    return { ok: false, issues: ['unexpected-migration'] }
  }
  return { ok: true }
}

export async function checkSuppressionRepository(root = process.cwd()) {
  let declaration
  try {
    declaration = JSON.parse(await readFile(resolve(root, 'supabase/native-mail-suppression.json'), 'utf8'))
  } catch {
    return { ok: false, issues: ['unreadable-declaration'] }
  }
  const result = validateSuppressionDeclaration(declaration)
  if (!result.ok) return result
  try {
    return validateSuppressionMigration(await readFile(resolve(root, 'supabase', declaration.migration), 'utf8'))
  } catch {
    return { ok: false, issues: ['unreadable-migration'] }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await checkSuppressionRepository()
  if (result.ok)
    console.log('Supabase suppression repository declaration and migration match. Runtime binding unverified.')
  else console.error(`Supabase suppression check failed: ${result.issues.join(', ')}.`)
  process.exitCode = result.ok ? 0 : 1
}
