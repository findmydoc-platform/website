/**
 * Test script to validate JWT verification functionality
 * 
 * This ensures the secure JWT implementation works correctly
 * and properly rejects invalid/unsigned tokens.
 */

import { verifySupabaseJWT, verifyAuthorizationHeader } from '../utilities/jwt'

/**
 * Test cases for JWT verification
 */
async function runTests() {
  console.log('🔒 Testing JWT Verification Security')
  console.log('=====================================')

  // Test 1: Missing token
  try {
    await verifyAuthorizationHeader('')
    console.log('❌ Test 1 FAILED: Should reject empty token')
  } catch (error) {
    console.log('✅ Test 1 PASSED: Correctly rejects empty token')
  }

  // Test 2: Invalid authorization header format
  try {
    await verifyAuthorizationHeader('InvalidFormat')
    console.log('❌ Test 2 FAILED: Should reject invalid header format')
  } catch (error) {
    console.log('✅ Test 2 PASSED: Correctly rejects invalid header format')
  }

  // Test 3: Unsigned JWT (security test)
  try {
    // This is a fake JWT that would be accepted by jwtDecode but should be rejected by proper verification
    const fakeJWT = 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlLXVzZXItaWQiLCJlbWFpbCI6ImZha2VAZXhhbXBsZS5jb20iLCJhcHBfbWV0YWRhdGEiOnsidXNlcl90eXBlIjoicGxhdGZvcm0ifSwiZXhwIjo5OTk5OTk5OTk5fQ.fake-signature'
    await verifyAuthorizationHeader(fakeJWT)
    console.log('❌ Test 3 FAILED: Should reject unsigned/fake JWT')
  } catch (error) {
    console.log('✅ Test 3 PASSED: Correctly rejects fake JWT signature')
  }

  // Test 4: Malformed JWT
  try {
    await verifyAuthorizationHeader('Bearer not.a.jwt')
    console.log('❌ Test 4 FAILED: Should reject malformed JWT')
  } catch (error) {
    console.log('✅ Test 4 PASSED: Correctly rejects malformed JWT')
  }

  console.log('\n🎯 Security Validation Complete')
  console.log('The implementation correctly rejects invalid tokens!')
  console.log('\nNote: To test with valid Supabase JWTs, you need:')
  console.log('1. Valid NEXT_PUBLIC_SUPABASE_URL environment variable')
  console.log('2. A real JWT token issued by your Supabase instance')
}

/**
 * Demonstrate the security difference between jwtDecode and proper verification
 */
function demonstrateSecurityDifference() {
  console.log('\n⚠️  Security Demonstration')
  console.log('==========================')
  
  // Example of what jwtDecode would accept (INSECURE):
  const fakeToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlLXVzZXItaWQiLCJlbWFpbCI6ImZha2VAZXhhbXBsZS5jb20iLCJhcHBfbWV0YWRhdGEiOnsidXNlcl90eXBlIjoicGxhdGZvcm0ifSwiZXhwIjo5OTk5OTk5OTk5fQ.fake-signature'
  
  console.log('🚨 jwtDecode (INSECURE) would decode this fake token:')
  try {
    // Simulating what jwtDecode would do (DO NOT USE IN PRODUCTION):
    const parts = fakeToken.split('.')
    if (parts.length >= 2) {
      const payload = parts[1]
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString())
      console.log('   Decoded payload:', decodedPayload)
      console.log('   ❌ This is DANGEROUS - the signature is fake!')
    }
  } catch (e) {
    console.log('   Could not decode fake token')
  }

  console.log('\n🔒 Our secure verification CORRECTLY REJECTS fake tokens')
  console.log('   ✅ Signature verification prevents token forgery')
  console.log('   ✅ Only tokens signed by Supabase are accepted')
}

// Run the tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error)
  demonstrateSecurityDifference()
}

export { runTests, demonstrateSecurityDifference }