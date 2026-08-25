import type { ApplicantStage } from './applicant.types'

export const STAGES = [
  { code: 'DOCUMENT_REVIEW', label: '서류검토' },
  { code: 'INTERVIEW', label: '면접' },
  { code: 'OFFER', label: '처우협의' },
  { code: 'HIRED', label: '최종합격' },
  { code: 'REJECTED', label: '불합격' },
] as const satisfies ReadonlyArray<{ code: ApplicantStage; label: string }>
