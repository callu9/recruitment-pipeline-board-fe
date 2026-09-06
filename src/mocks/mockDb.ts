import { APPLICANT_OWNERS, APPLICANT_ROLES, type Applicant, type ApplicantStage, type Position } from '../features/recruitment-board/model/applicant.types'
import { STAGES } from '../features/recruitment-board/model/stages'
import { createSeedApplicants, SEED_POSITIONS } from './seedApplicants'
import {
  DEFAULT_APPLICANT_SEED_SIZE,
  getApplicantSeedSize,
  type ApplicantSeedSize,
} from './mockConfig'

export const STORAGE_KEY = 'recruitment-pipeline-board:applicants:v1'
export const POSITIONS_STORAGE_KEY = 'recruitment-pipeline-board:positions:v1'

export function getApplicantsStorageKey(size: ApplicantSeedSize = getApplicantSeedSize()) {
  return size === DEFAULT_APPLICANT_SEED_SIZE ? STORAGE_KEY : `${STORAGE_KEY}:${size}`
}

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
    && (applicant.owner === undefined || APPLICANT_OWNERS.includes(applicant.owner as (typeof APPLICANT_OWNERS)[number]))
    && (applicant.positionId === undefined || typeof applicant.positionId === 'string')
    && (applicant.nextAction === undefined || typeof applicant.nextAction === 'string')
    && (applicant.dueDate === undefined || typeof applicant.dueDate === 'string')
    && (applicant.schedule === undefined || applicant.schedule === null || typeof applicant.schedule === 'object')
    && (applicant.evaluations === undefined || Array.isArray(applicant.evaluations))
    && (applicant.notes === undefined || Array.isArray(applicant.notes))
    && (applicant.timeline === undefined || Array.isArray(applicant.timeline))
  )
}

function readStoredApplicants(): Applicant[] | null {
  const stored = localStorage.getItem(getApplicantsStorageKey())
  if (stored === null) return null

  try {
    const applicants: unknown = JSON.parse(stored)
    return Array.isArray(applicants) && applicants.every(isApplicant) ? applicants : null
  } catch {
    return null
  }
}

export function saveApplicants(applicants: Applicant[]) {
  localStorage.setItem(getApplicantsStorageKey(), JSON.stringify(applicants))
}

function hasMissingWorkspaceFields(applicant: Applicant) {
  return applicant.owner === undefined
    || applicant.positionId === undefined
    || applicant.nextAction === undefined
    || applicant.dueDate === undefined
    || applicant.schedule === undefined
    || applicant.evaluations === undefined
    || applicant.notes === undefined
    || applicant.timeline === undefined
}

function migrateWorkspaceFields(applicants: Applicant[]) {
  const templates = createSeedApplicants(Math.max(applicants.length, getApplicantSeedSize()))
  return applicants.map((applicant, index) => {
    const template = templates.find(({ id }) => id === applicant.id) ?? templates[index % templates.length]
    return {
      ...applicant,
      owner: applicant.owner === undefined ? template.owner : applicant.owner,
      positionId: applicant.positionId === undefined ? template.positionId : applicant.positionId,
      nextAction: applicant.nextAction === undefined ? template.nextAction : applicant.nextAction,
      dueDate: applicant.dueDate === undefined ? template.dueDate : applicant.dueDate,
      schedule: applicant.schedule === undefined ? template.schedule : applicant.schedule,
      evaluations: applicant.evaluations === undefined ? template.evaluations : applicant.evaluations,
      notes: applicant.notes === undefined ? template.notes : applicant.notes,
      timeline: applicant.timeline === undefined ? template.timeline : applicant.timeline,
    }
  })
}

export function loadApplicants(): Applicant[] {
  const applicants = readStoredApplicants()
  if (applicants) {
    if (!applicants.some(hasMissingWorkspaceFields)) return applicants
    const migrated = migrateWorkspaceFields(applicants)
    saveApplicants(migrated)
    return migrated
  }
  if (localStorage.getItem(getApplicantsStorageKey()) !== null) {
    console.warn('Resetting invalid applicant storage')
  }
  return resetApplicants()
}

export function resetApplicants(size = getApplicantSeedSize()) {
  const applicants = createSeedApplicants(size)
  saveApplicants(applicants)
  return applicants
}

export function updateApplicantStage(applicantId: string, stage: ApplicantStage): Applicant {
  const storedApplicants = readStoredApplicants()
  const applicants = storedApplicants
    ? (storedApplicants.some(hasMissingWorkspaceFields) ? migrateWorkspaceFields(storedApplicants) : storedApplicants)
    : createSeedApplicants(getApplicantSeedSize())
  const applicant = applicants.find(({ id }) => id === applicantId)
  if (!applicant) throw new Error(`Applicant not found: ${applicantId}`)

  const updatedApplicant = { ...applicant, stage }
  saveApplicants(applicants.map((current) => (current.id === applicantId ? updatedApplicant : current)))
  return updatedApplicant
}

export function getApplicantSnapshot() {
  return readStoredApplicants() ?? createSeedApplicants(getApplicantSeedSize())
}

function isPosition(value: unknown): value is Position {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const position = value as Record<string, unknown>
  return typeof position.id === 'string'
    && typeof position.title === 'string'
    && APPLICANT_ROLES.includes(position.role as Position['role'])
    && typeof position.department === 'string'
    && typeof position.requiredCount === 'number'
    && typeof position.deadline === 'string'
    && ['OPEN', 'PAUSED', 'CLOSED'].includes(position.status as string)
}

export function loadPositions(): Position[] {
  const stored = localStorage.getItem(POSITIONS_STORAGE_KEY)
  if (stored) {
    try {
      const positions: unknown = JSON.parse(stored)
      if (Array.isArray(positions) && positions.every(isPosition)) return positions
    } catch {
      // Reset below when the stored mock payload is invalid.
    }
  }
  localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(SEED_POSITIONS))
  return SEED_POSITIONS
}
