import type { Applicant, ApplicantStage } from './applicant.types'
import { applyStageTransition, type StageTransitionOptions } from './stages'

export function replaceApplicant(applicants: Applicant[], replacement: Applicant): Applicant[] {
  return applicants.map((applicant) => (applicant.id === replacement.id ? replacement : applicant))
}

export function moveApplicantOptimistically(
  applicants: Applicant[],
  applicantId: string,
  targetStage: ApplicantStage,
  transitionAt: string,
  options?: StageTransitionOptions,
): Applicant[] {
  return applicants.map((applicant) => applicant.id === applicantId ? applyStageTransition(applicant, targetStage, transitionAt, options) : applicant)
}
