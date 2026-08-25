import type { Applicant, ApplicantStage } from './applicant.types'
import { STAGES } from './stages'

export function groupApplicantsByStage(applicants: Applicant[]): Record<ApplicantStage, Applicant[]> {
  const grouped = {} as Record<ApplicantStage, Applicant[]>
  for (const { code } of STAGES) grouped[code] = []

  for (const applicant of applicants) grouped[applicant.stage].push(applicant)

  return grouped
}
