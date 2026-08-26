import type { ApplicantStage } from './applicant.types'

export const STAGES = [
  { code: 'DOCUMENT_REVIEW', label: '서류검토' },
  { code: 'INTERVIEW', label: '면접' },
  { code: 'OFFER', label: '처우협의' },
  { code: 'HIRED', label: '최종합격' },
  { code: 'REJECTED', label: '불합격' },
] as const satisfies ReadonlyArray<{ code: ApplicantStage; label: string }>

export const ALLOWED_NEXT_STAGES: Readonly<Record<ApplicantStage, readonly ApplicantStage[]>> = {
  DOCUMENT_REVIEW: ['INTERVIEW', 'REJECTED'],
  INTERVIEW: ['OFFER', 'REJECTED'],
  OFFER: ['HIRED', 'REJECTED'],
  HIRED: [],
  REJECTED: [],
}

export function getAllowedNextStages(currentStage: ApplicantStage) {
  return ALLOWED_NEXT_STAGES[currentStage]
}

export function canTransitionTo(currentStage: ApplicantStage, targetStage: ApplicantStage) {
  return getAllowedNextStages(currentStage).includes(targetStage)
}
