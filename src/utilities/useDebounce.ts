import { useState, useEffect } from 'react'

/**
 * React hook that debounces a value, delaying updates until after a specified delay.
 * Useful for search inputs, API calls, or any scenario where you want to limit rapid changes.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds before updating (default: 200ms)
 * @returns Debounced value that updates after the delay period
 *
 * @example
 * const [searchTerm, setSearchTerm] = useState('')
 * const debouncedSearchTerm = useDebounce(searchTerm, 500)
 *
 * // debouncedSearchTerm will only update 500ms after searchTerm stops changing
 */
export function useDebounce<T>(value: T, delay = 200): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
