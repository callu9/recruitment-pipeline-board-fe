import type { Applicant, ApplicantRole, ApplicantStage } from './applicant.types'
import { STAGES } from './stages'

export interface ApplicantFilters {
  nameQuery: string
  role: ApplicantRole | 'ALL'
}

export function filterApplicants(applicants: Applicant[], { nameQuery, role }: ApplicantFilters): Applicant[] {
  const normalizedNameQuery = nameQuery.trim().toLowerCase()

  return applicants.filter(
    (applicant) =>
      applicant.name.trim().toLowerCase().includes(normalizedNameQuery) &&
      (role === 'ALL' || applicant.role === role),
  )
}

export function getApplicantRoles(applicants: Applicant[]): ApplicantRole[] {
  return [...new Set(applicants.map((applicant) => applicant.role))]
}

export function groupApplicantsByStage(applicants: Applicant[]): Record<ApplicantStage, Applicant[]> {
  const grouped = {} as Record<ApplicantStage, Applicant[]>
  for (const { code } of STAGES) grouped[code] = []

  for (const applicant of applicants) grouped[applicant.stage].push(applicant)

  return grouped
}
