#!/usr/bin/env node

/**
 * Integration test to validate the secure JWT implementation
 * This can be run to verify the security fix works correctly
 */

const { runTests, demonstrateSecurityDifference } = require('./test-jwt-security')

async function main() {
  console.log('🔐 JWT Security Validation')
  console.log('=========================')
  console.log('')
  console.log('This test validates that issue #200 has been properly fixed.')
  console.log('The secure JWT implementation should reject all invalid tokens.')
  console.log('')

  try {
    // Run security tests
    await runTests()
    
    console.log('')
    
    // Demonstrate the security difference
    demonstrateSecurityDifference()
    
    console.log('')
    console.log('✅ All security tests passed!')
    console.log('The JWT verification implementation is secure.')
    console.log('')
    console.log('Next steps:')
    console.log('1. Deploy this implementation to replace insecure jwtDecode usage')
    console.log('2. Update any existing authentication strategies to use secure verification')
    console.log('3. Ensure NEXT_PUBLIC_SUPABASE_URL is configured for production')
    
  } catch (error) {
    console.error('❌ Security test failed:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}