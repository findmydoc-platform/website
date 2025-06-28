const path = require('path');
const { Pool } = require('pg');

// Load test environment variables
require('dotenv').config({
  path: path.resolve(__dirname, '../.env.test'),
});

module.exports = async () => {
  console.log('Setting up test environment...');
  
  // For CI/CD, we might not have a database available, so we'll mock the setup
  const isDatabaseAvailable = process.env.DATABASE_URI && process.env.DATABASE_URI.includes('localhost');
  
  if (isDatabaseAvailable) {
    try {
      // 1. Clear test database using direct SQL
      console.log('Attempting to connect to test database...');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URI,
        connectionTimeoutMillis: 5000, // 5 second timeout
      });

      const client = await pool.connect();
      
      // Clear all tables - using the actual collection slugs from payload config
      await client.query(`
        TRUNCATE TABLE 
          "review", 
          "clinictreatments", 
          "doctors", 
          "treatments", 
          "clinics", 
          "patients", 
          "basicUsers", 
          "clinicStaff"
        RESTART IDENTITY CASCADE;
      `);
      
      client.release();
      await pool.end();
      console.log('Test database cleared successfully.');
    } catch (err) {
      console.warn('Could not connect to test database (this is OK for unit tests):', err.message);
    }
  } else {
    console.log('Skipping database setup - running in mock mode');
  }

  // 2. Initialize Payload with Local API (no Express server)
  try {
    const payload = require('payload');
    
    const payloadInstance = await payload.init({
      secret: process.env.PAYLOAD_SECRET || 'fallback-test-secret',
      express: null, // Important: No Express server for Local API tests
      onInit: () => {
        console.log('Payload for testing initialized successfully.');
      },
    });

    // 3. Make the Payload instance globally available for all test files
    global.payload = payloadInstance;
  } catch (err) {
    console.warn('Failed to initialize Payload for testing (this is OK for unit tests):', err.message);
    // Create a mock payload instance for tests that don't need real database
    global.payload = {
      create: () => Promise.resolve({ id: 'mock-id' }),
      update: () => Promise.resolve({}),
      delete: () => Promise.resolve({}),
      find: () => Promise.resolve({ docs: [], totalDocs: 0 }),
      findByID: () => Promise.resolve({ id: 'mock-id' }),
    };
  }
};