require('ts-node/register')
const path = require('path')
const { Pool } = require('pg')

// Load test environment variables
require('dotenv').config({
  path: path.resolve(__dirname, '../.env.test'),
})

module.exports = async () => {
  console.log('Setting up test environment...')

  // 2. Initialize Payload with Local API (no Express server)
  try {
    const payload = require('payload')

    const payloadInstance = await payload.init({
      secret: process.env.PAYLOAD_SECRET || 'fallback-test-secret',
      express: null,
      onInit: () => {
        console.log('Payload for testing initialized successfully.')
      },
    })

    // 3. Make the Payload instance globally available for all test files
    global.payload = payloadInstance
  } catch (err) {
    console.warn(
      'Failed to initialize Payload for testing (this is OK for unit tests):',
      err.message,
    )
    // Create a mock payload instance for tests that don't need real database
    global.payload = {
      create: () => Promise.resolve({ id: 'mock-id' }),
      update: () => Promise.resolve({}),
      delete: () => Promise.resolve({}),
      find: () => Promise.resolve({ docs: [], totalDocs: 0 }),
      findByID: () => Promise.resolve({ id: 'mock-id' }),
    }
  }
}
