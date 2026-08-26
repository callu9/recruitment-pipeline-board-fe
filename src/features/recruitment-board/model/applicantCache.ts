import type { Applicant, ApplicantStage } from './applicant.types'

export function replaceApplicant(applicants: Applicant[], replacement: Applicant): Applicant[] {
  return applicants.map((applicant) => (applicant.id === replacement.id ? replacement : applicant))
}

export function moveApplicantOptimistically(
  applicants: Applicant[],
  applicantId: string,
  targetStage: ApplicantStage,
): Applicant[] {
  return applicants.map((applicant) => (applicant.id === applicantId ? { ...applicant, stage: targetStage } : applicant))
}
