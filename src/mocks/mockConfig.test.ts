import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  DEFAULT_APPLICANT_SEED_SIZE,
  DEFAULT_FAILURE_RATE,
  PERFORMANCE_APPLICANT_SEED_SIZE,
  resolveApplicantSeedSize,
  resolveFailureRate,
} from './mockConfig'

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

describe('resolveApplicantSeedSize', () => {
  test.each([
    [undefined, DEFAULT_APPLICANT_SEED_SIZE],
    ['240', DEFAULT_APPLICANT_SEED_SIZE],
    ['1000', PERFORMANCE_APPLICANT_SEED_SIZE],
    ['0', DEFAULT_APPLICANT_SEED_SIZE],
    ['invalid', DEFAULT_APPLICANT_SEED_SIZE],
  ])('normalizes %s to %s', (value, expected) => {
    expect(resolveApplicantSeedSize(value)).toBe(expected)
  })

  test('uses VITE_APPLICANT_SEED_SIZE after reloading the module', async () => {
    vi.stubEnv('VITE_APPLICANT_SEED_SIZE', '1000')
    vi.resetModules()

    const { getApplicantSeedSize } = await import('./mockConfig')

    expect(getApplicantSeedSize()).toBe(PERFORMANCE_APPLICANT_SEED_SIZE)
  })
})
