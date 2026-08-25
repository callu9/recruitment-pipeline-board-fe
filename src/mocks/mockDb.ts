import { APPLICANT_ROLES, type Applicant, type ApplicantStage } from '../features/recruitment-board/model/applicant.types'
import { STAGES } from '../features/recruitment-board/model/stages'
import { createSeedApplicants } from './seedApplicants'

export const STORAGE_KEY = 'recruitment-pipeline-board:applicants:v1'

function isApplicant(value: unknown): value is Applicant {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const applicant = value as Record<string, unknown>
  return (
    typeof applicant.id === 'string' &&
    typeof applicant.name === 'string' &&
    APPLICANT_ROLES.includes(applicant.role as Applicant['role']) &&
    typeof applicant.appliedAt === 'string' &&
    STAGES.some(({ code }) => code === applicant.stage) &&
    typeof applicant.email === 'string' &&
    typeof applicant.phone === 'string' &&
    typeof applicant.experienceYears === 'number' &&
    Array.isArray(applicant.skills) &&
    applicant.skills.every((skill) => typeof skill === 'string') &&
    typeof applicant.note === 'string'
  )
}

function readStoredApplicants(): Applicant[] | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === null) return null

  try {
    const applicants: unknown = JSON.parse(stored)
    return Array.isArray(applicants) && applicants.every(isApplicant) ? applicants : null
  } catch {
    return null
  }
}

export function saveApplicants(applicants: Applicant[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants))
}

export function loadApplicants(): Applicant[] {
  const applicants = readStoredApplicants()
  if (applicants) return applicants
  if (localStorage.getItem(STORAGE_KEY) !== null) console.warn('Resetting invalid applicant storage')
  return resetApplicants()
}

export function resetApplicants(size = 240) {
  const applicants = createSeedApplicants(size)
  saveApplicants(applicants)
  return applicants
}

export function updateApplicantStage(applicantId: string, stage: ApplicantStage): Applicant {
  const applicants = readStoredApplicants() ?? createSeedApplicants()
  const applicant = applicants.find(({ id }) => id === applicantId)
  if (!applicant) throw new Error(`Applicant not found: ${applicantId}`)

  const updatedApplicant = { ...applicant, stage }
  saveApplicants(applicants.map((current) => (current.id === applicantId ? updatedApplicant : current)))
  return updatedApplicant
}

export function getApplicantSnapshot() {
  return readStoredApplicants() ?? createSeedApplicants()
}
