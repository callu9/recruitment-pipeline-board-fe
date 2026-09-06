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

export const APPLICANT_OWNERS = ['김하나', '이서준', '박민지', '최유진'] as const
export type ApplicantOwner = (typeof APPLICANT_OWNERS)[number]

export const EVALUATION_TYPES = ['SCREEN', 'INTERVIEW', 'FINAL'] as const
export type EvaluationType = (typeof EVALUATION_TYPES)[number]

export type EvaluationStatus = 'PENDING' | 'SUBMITTED'

export interface InterviewSchedule {
  date: string
  startTime: string
  endTime: string
  format: 'VIDEO' | 'ONSITE'
  interviewer: string
}

export interface ApplicantEvaluation {
  id: string
  type: EvaluationType
  status: EvaluationStatus
  dueDate: string
  reviewer: ApplicantOwner
  score?: number
  comment?: string
}

export interface ApplicantNote {
  id: string
  author: ApplicantOwner
  createdAt: string
  text: string
}

export interface ApplicantTimelineEvent {
  id: string
  at: string
  label: string
}

export interface Position {
  id: string
  title: string
  role: ApplicantRole
  department: string
  requiredCount: number
  deadline: string
  status: 'OPEN' | 'PAUSED' | 'CLOSED'
}

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
  owner?: ApplicantOwner
  positionId?: string
  nextAction?: string
  dueDate?: string
  schedule?: InterviewSchedule | null
  evaluations?: ApplicantEvaluation[]
  notes?: ApplicantNote[]
  timeline?: ApplicantTimelineEvent[]
}

export interface MoveApplicantStageRequest {
  stage: ApplicantStage
}

export interface ApiErrorBody {
  code: 'MOCK_FAILURE' | 'NOT_FOUND' | 'INVALID_STAGE' | 'INVALID_TRANSITION' | 'INVALID_BODY'
  message: string
}
