require('ts-node/register')

module.exports = async () => {
  console.log('Tearing down test environment...')

  // Cleanup if needed - for now, just log
  if (global.payload) {
    // PayloadCMS doesn't need explicit cleanup in most cases
    console.log('Test environment torn down successfully.')
  }
}
