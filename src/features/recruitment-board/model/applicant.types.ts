export type ApplicantStage =
  | 'DOCUMENT_REVIEW'
  | 'INTERVIEW'
  | 'OFFER'
  | 'HIRED'
  | 'REJECTED'

export const APPLICANT_ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Product Designer',
  'Product Manager',
  'Data Analyst',
  'QA Engineer',
] as const

export type ApplicantRole = (typeof APPLICANT_ROLES)[number]

export interface Applicant {
  id: string
  name: string
  role: ApplicantRole
  appliedAt: string
  stage: ApplicantStage
  email: string
  phone: string
  experienceYears: number
  skills: string[]
  note: string
}

export interface MoveApplicantStageRequest {
  stage: ApplicantStage
}

export interface ApiErrorBody {
  code: 'MOCK_FAILURE' | 'NOT_FOUND' | 'INVALID_STAGE' | 'INVALID_BODY'
  message: string
}
