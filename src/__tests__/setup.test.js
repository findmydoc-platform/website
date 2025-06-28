/**
 * Basic test to verify Jest setup is working correctly
 */

describe('Jest Setup Verification', () => {
  test('should pass basic assertion', () => {
    expect(1 + 1).toBe(2)
  })
  
  test('should handle async operations', async () => {
    const result = await Promise.resolve('test')
    expect(result).toBe('test')
  })
})