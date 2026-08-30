export const MIN_DELAY_MS = 200
export const MAX_DELAY_MS = 800
export const DEFAULT_FAILURE_RATE = 0.15
export const DEFAULT_APPLICANT_SEED_SIZE = 240
export const PERFORMANCE_APPLICANT_SEED_SIZE = 1000

export type ApplicantSeedSize =
  | typeof DEFAULT_APPLICANT_SEED_SIZE
  | typeof PERFORMANCE_APPLICANT_SEED_SIZE

export function resolveFailureRate(value: string | undefined) {
  const rate = Number(value ?? DEFAULT_FAILURE_RATE)
  if (!Number.isFinite(rate)) return DEFAULT_FAILURE_RATE
  return Math.min(Math.max(rate, 0), 1)
}

export function resolveApplicantSeedSize(value: string | undefined): ApplicantSeedSize {
  return value === String(PERFORMANCE_APPLICANT_SEED_SIZE)
    ? PERFORMANCE_APPLICANT_SEED_SIZE
    : DEFAULT_APPLICANT_SEED_SIZE
}

const browserFailureRate = resolveFailureRate(import.meta.env.VITE_MOCK_FAILURE_RATE)
const browserApplicantSeedSize = resolveApplicantSeedSize(
  import.meta.env.VITE_APPLICANT_SEED_SIZE,
)

let testConfig: {
  delayMs?: number
  failureRate?: number
  applicantSeedSize?: ApplicantSeedSize
} = {}

export function setMockApiTestConfig(config: {
  delayMs?: number
  failureRate?: number
  applicantSeedSize?: ApplicantSeedSize
}) {
  testConfig = config
}

export function resetMockApiTestConfig() {
  testConfig = {}
}

export function getApplicantSeedSize() {
  return testConfig.applicantSeedSize ?? browserApplicantSeedSize
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
