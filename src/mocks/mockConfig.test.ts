import { afterEach, describe, expect, test, vi } from 'vitest'
import { DEFAULT_FAILURE_RATE, resolveFailureRate } from './mockConfig'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('resolveFailureRate', () => {
  test.each([
    [undefined, DEFAULT_FAILURE_RATE],
    ['0', 0],
    ['1', 1],
    ['-1', 0],
    ['2', 1],
    ['invalid', DEFAULT_FAILURE_RATE],
  ])('normalizes %s to %s', (value, expected) => {
    expect(resolveFailureRate(value)).toBe(expected)
  })

  test.each([
    ['0', false],
    ['1', true],
  ])('uses VITE_MOCK_FAILURE_RATE=%s after reloading the module', async (value, expected) => {
    vi.stubEnv('VITE_MOCK_FAILURE_RATE', value)
    vi.resetModules()

    const { shouldMockApiFail } = await import('./mockConfig')

    expect(shouldMockApiFail(() => 0.5)).toBe(expected)
  })
})
