export const MIN_DELAY_MS = 200
export const MAX_DELAY_MS = 800
export const DEFAULT_FAILURE_RATE = 0.15

export function resolveFailureRate(value: string | undefined) {
  const rate = Number(value ?? DEFAULT_FAILURE_RATE)
  if (!Number.isFinite(rate)) return DEFAULT_FAILURE_RATE
  return Math.min(Math.max(rate, 0), 1)
}

const browserFailureRate = resolveFailureRate(import.meta.env.VITE_MOCK_FAILURE_RATE)

let testConfig: { delayMs?: number; failureRate?: number } = {}

export function setMockApiTestConfig(config: { delayMs?: number; failureRate?: number }) {
  testConfig = config
}

export function resetMockApiTestConfig() {
  testConfig = {}
}

export function getMockDelay(random = Math.random) {
  return testConfig.delayMs ?? MIN_DELAY_MS + Math.floor(random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1))
}

export function shouldMockApiFail(random = Math.random) {
  return random() < (testConfig.failureRate ?? browserFailureRate)
}

export function waitForMockDelay() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, getMockDelay()))
}
