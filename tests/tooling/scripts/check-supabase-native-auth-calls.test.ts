import { describe, expect, it } from 'vitest'
import { checkNativeAuthCalls, checkNativeAuthRepository } from '../../../scripts/check-supabase-native-auth-calls.mjs'

const path = 'src/app/api/auth/register/patient/route.ts'
const source = 'export async function POST() { await client.auth.signUp({}); }'
const inventory = {
  version: 1,
  flows: [{ id: 'patient-verification', status: 'unreplaced', issue: 1734, scopes: [{ path, scope: 'POST' }] }],
  calls: [{ flow: 'patient-verification', path, scope: 'POST', method: 'signUp', count: 1 }],
}

describe('Supabase native Auth source guard', () => {
  it('allows the recorded native call while its product flow remains unreplaced', () => {
    expect(checkNativeAuthCalls([{ path, source }], inventory)).toEqual({ ok: true, issues: [] })
  })

  it('rejects that same native API after the flow is marked replaced', () => {
    expect(
      checkNativeAuthCalls([{ path, source }], {
        ...inventory,
        flows: [{ id: 'patient-verification', status: 'replaced', issue: 1734, scopes: [{ path, scope: 'POST' }] }],
      }),
    ).toMatchObject({ ok: false, issues: [{ code: 'prohibited-native-api', path, scope: 'POST', method: 'signUp' }] })
  })

  it('does not block unrelated native calls when a different flow is replaced', () => {
    expect(
      checkNativeAuthCalls(
        [
          { path, source: 'export async function POST() { await generateLink(); }' },
          {
            path: 'src/auth/platformInvitation.ts',
            source: 'export async function invitePlatform() { await client.auth.admin.inviteUserByEmail({}); }',
          },
        ],
        {
          ...inventory,
          flows: [{ id: 'patient-verification', status: 'replaced', issue: 1734, scopes: [{ path, scope: 'POST' }] }],
        },
      ),
    ).toEqual({ ok: true, issues: [] })
  })

  it.each([
    'export async function POST() { let auth; auth = client.auth; await auth.signUp({}); }',
    'const send = client.auth.signUp; export async function POST() { await send({}); }',
    'export async function POST() { const send = () => client.auth.signUp({}); await send(); }',
  ])('rejects a native call reached through an alias or nested callback', (source) => {
    expect(
      checkNativeAuthCalls([{ path, source }], {
        ...inventory,
        flows: [{ ...inventory.flows[0], status: 'replaced' }],
      }),
    ).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'prohibited-native-api', path, scope: 'POST', method: 'signUp' })],
    })
  })

  it.each([
    { method: 'signUp', receiver: 'client.auth' },
    { method: 'resetPasswordForEmail', receiver: 'client.auth' },
    { method: 'inviteUserByEmail', receiver: 'client.auth.admin' },
  ])('rejects $method through a module alias declared after the protected function', ({ method, receiver }) => {
    const source = `export async function POST() { await sdkAuth.${method}({}); } const sdkAuth = ${receiver};`
    expect(
      checkNativeAuthCalls([{ path, source }], {
        ...inventory,
        flows: [{ ...inventory.flows[0], status: 'replaced' }],
      }),
    ).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'prohibited-native-api', path, scope: 'POST', method })],
    })
  })

  it('keeps a shadowing parameter and an unrelated local receiver outside native API detection', () => {
    const source = `
      export function POST(sdkAuth) { sdkAuth.signUp(); const local = newsletter; local.resetPasswordForEmail(); }
      const sdkAuth = client.auth;
    `
    expect(
      checkNativeAuthCalls([{ path, source }], {
        ...inventory,
        flows: [{ ...inventory.flows[0], status: 'replaced' }],
      }),
    ).toEqual({ ok: true, issues: [] })
  })

  it.each([
    { method: 'signUp', receiver: 'client.auth', alternative: 'other.auth' },
    { method: 'resetPasswordForEmail', receiver: 'client.auth', alternative: 'newsletter' },
    { method: 'inviteUserByEmail', receiver: 'client.auth.admin', alternative: 'other.auth.admin' },
  ])('rejects $method when a conditional alias can select an Auth receiver', ({ method, receiver, alternative }) => {
    const source = `export async function POST() {
      const sdkAuth = condition ? ${receiver} : ${alternative}; await sdkAuth.${method}({});
    }`
    expect(
      checkNativeAuthCalls([{ path, source }], {
        ...inventory,
        flows: [{ ...inventory.flows[0], status: 'replaced' }],
      }),
    ).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'prohibited-native-api', path, scope: 'POST', method })],
    })
  })

  it.each([
    { method: 'signUp', receiver: 'client.auth' },
    { method: 'resetPasswordForEmail', receiver: 'client.auth' },
    { method: 'inviteUserByEmail', receiver: 'client.auth.admin' },
  ])('retains possible $method provenance after a block-scoped assignment', ({ method, receiver }) => {
    const source = `export async function POST() {
      let sdkAuth = newsletter; if (condition) { sdkAuth = ${receiver}; } await sdkAuth.${method}({});
    }`
    expect(
      checkNativeAuthCalls([{ path, source }], {
        ...inventory,
        flows: [{ ...inventory.flows[0], status: 'replaced' }],
      }),
    ).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'prohibited-native-api', path, scope: 'POST', method })],
    })
  })

  it('does not merge a shadowing block variable into an unrelated conditional receiver', () => {
    const source = `export function POST() {
      const sdkAuth = condition ? newsletter : marketing;
      if (condition) { const sdkAuth = client.auth; inspect(sdkAuth); }
      sdkAuth.signUp();
    }`
    expect(
      checkNativeAuthCalls([{ path, source }], {
        ...inventory,
        flows: [{ ...inventory.flows[0], status: 'replaced' }],
      }),
    ).toEqual({ ok: true, issues: [] })
  })

  it.each([
    { method: 'signUp', receiver: 'client.auth' },
    { method: 'resetPasswordForEmail', receiver: 'client.auth' },
    { method: 'inviteUserByEmail', receiver: 'client.auth.admin' },
  ])('rejects a detached bound $method invocation inside the replaced function', ({ method, receiver }) => {
    const source = `const send = ${receiver}.${method}.bind(${receiver}); export async function POST() { await send({}); }`
    expect(
      checkNativeAuthCalls([{ path, source }], {
        ...inventory,
        flows: [{ ...inventory.flows[0], status: 'replaced' }],
      }),
    ).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: 'prohibited-native-api', path, scope: 'POST', method })],
    })
  })

  it('allows a shadowing unrelated bound method inside the replaced function', () => {
    const source = `
      const send = client.auth.signUp.bind(client.auth);
      export async function POST() { const send = newsletter.signUp.bind(newsletter); await send({}); }
    `
    expect(
      checkNativeAuthCalls([{ path, source }], {
        ...inventory,
        flows: [{ ...inventory.flows[0], status: 'replaced' }],
      }),
    ).toEqual({ ok: true, issues: [] })
  })

  it.each(['unreplaced', 'excluded'])(
    'allows late, conditional, assigned, and bound aliases in a %s flow',
    (status) => {
      const source = `export async function POST() {
      let chosen = condition ? sdkAuth : newsletter; if (condition) { chosen = sdkAuth; }
      const send = chosen.signUp.bind(chosen); await send({});
    } const sdkAuth = client.auth;`
      expect(
        checkNativeAuthCalls([{ path, source }], {
          ...inventory,
          flows: [{ ...inventory.flows[0], status, issue: status === 'excluded' ? null : 1734 }],
        }),
      ).toEqual({ ok: true, issues: [] })
    },
  )

  it.each([
    { method: 'signUp', source: 'export async function POST() { await client.auth["signUp"]({}); }' },
    {
      method: 'resetPasswordForEmail',
      source: 'export async function POST() { const { auth } = client; await auth?.resetPasswordForEmail({}); }',
    },
    {
      method: 'inviteUserByEmail',
      source:
        'export async function POST() { const { inviteUserByEmail: invite } = client.auth.admin; await invite({}); }',
    },
  ])('rejects replaced $method access through brackets, optional access, or destructuring', ({ method, source }) => {
    const result = checkNativeAuthCalls([{ path, source }], {
      ...inventory,
      flows: [{ ...inventory.flows[0], status: 'replaced' }],
    })
    expect(result.ok).toBe(false)
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'prohibited-native-api', method })]),
    )
  })

  it('fails closed for dynamic Auth method selection in a replaced flow', () => {
    expect(
      checkNativeAuthCalls([{ path, source: 'export function POST() { return client.auth[method]({}); }' }], {
        ...inventory,
        flows: [{ ...inventory.flows[0], status: 'replaced' }],
      }),
    ).toEqual({ ok: false, issues: [{ code: 'unverifiable-auth-api', path, scope: 'POST', method: '<computed>' }] })
  })

  it('allows unrelated method names and Supabase action-link generation inside a replaced flow', () => {
    expect(
      checkNativeAuthCalls(
        [{ path, source: 'export function POST() { newsletter.signUp(); client.auth.admin.generateLink({}); }' }],
        {
          ...inventory,
          flows: [{ ...inventory.flows[0], status: 'replaced' }],
        },
      ),
    ).toEqual({ ok: true, issues: [] })
  })

  it('leaves another function in the same file outside a replaced clinic-invitation scope', () => {
    const path = 'src/auth/utilities/supabaseProvision.ts'
    expect(
      checkNativeAuthCalls(
        [
          {
            path,
            source: `
      export function inviteClinicSupabaseAccount() { return client.auth.admin.generateLink({}); }
      export function inviteSupabaseUser() { return client.auth.admin.inviteUserByEmail({}); }
    `,
          },
        ],
        {
          version: 1,
          calls: [],
          flows: [
            {
              id: 'clinic-invitation',
              status: 'replaced',
              issue: 1734,
              scopes: [{ path, scope: 'inviteClinicSupabaseAccount' }],
            },
            {
              id: 'legacy-account-invitation',
              status: 'excluded',
              issue: null,
              scopes: [{ path, scope: 'inviteSupabaseUser' }],
            },
          ],
        },
      ),
    ).toEqual({ ok: true, issues: [] })
  })

  it('rejects missing replaced scopes instead of silently losing coverage after a move', () => {
    expect(
      checkNativeAuthCalls([{ path, source: 'export function moved() {}' }], {
        ...inventory,
        flows: [{ ...inventory.flows[0], status: 'replaced' }],
      }),
    ).toEqual({ ok: false, issues: [{ code: 'missing-replaced-flow-scope', path, scope: 'POST' }] })
  })

  it('rejects a malformed inventory without printing its content', () => {
    expect(
      checkNativeAuthCalls([], {
        ...inventory,
        flows: [{ id: 'synthetic-untrusted-detail', status: 'replaced', issue: 99 }],
      }),
    ).toEqual({
      ok: false,
      issues: [{ code: 'invalid-native-call-inventory' }],
    })
  })

  it('runs the actual repository guard in the CI tooling suite', async () => {
    expect(await checkNativeAuthRepository()).toEqual({ ok: true, issues: [] })
  })
})
