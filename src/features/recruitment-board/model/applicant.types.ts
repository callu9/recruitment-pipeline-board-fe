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
  status?: 'PLANNED' | 'CONFIRMED' | 'COMPLETED' | 'POSTPONED' | 'CANCELLED' | 'NO_SHOW'
  active?: boolean
  round?: number
  history?: InterviewSchedule[]
}

export interface ApplicantEvaluation {
  id: string
  type: EvaluationType
  status: EvaluationStatus
  dueDate: string
  reviewer: ApplicantOwner
  score?: number
  comment?: string
  submittedAt?: string
  active?: boolean
  resumeOnReactivation?: boolean
  round?: number
  revisions?: Array<{ reviewer: ApplicantOwner; score?: number; comment?: string; submittedAt?: string; reason?: string }>
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
  fromStage?: ApplicantStage
  toStage?: ApplicantStage
  correction?: boolean
  rejectionReason?: string
  rejectionMemo?: string
  actor?: ApplicantOwner
  reason?: string
}

export interface Position {
  id: string
  title: string
  role: ApplicantRole
  department: string
  requiredCount: number
  deadline: string
  status: 'OPEN' | 'PAUSED' | 'CLOSED'
  description?: string
  evaluationCriteria?: string
  assignment?: string
  requiredInterviewRounds?: number
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
  rejectionReason?: string
  rejectionMemo?: string
  lifecycle?: 'ACTIVE' | 'ON_HOLD' | 'WITHDRAWN' | 'OFFER_DECLINED'
  lifecycleReason?: string
  archivedAt?: string
  deletedAt?: string
  talentPool?: boolean
  reconnectDate?: string
  contacts?: Array<{ id: string; channel: string; content: string; date: string; status: 'PLANNED' | 'DONE'; reply: string; actor: ApplicantOwner; followUpDate?: string }>
  offer?: { conditions: string; proposedAt: string; responseDueDate: string; status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED'; reason: string; active?: boolean; history?: Array<{ conditions: string; proposedAt: string; responseDueDate: string; status: string; reason: string; active?: boolean }> }
  employment?: { plannedStartDate: string; actualStartDate: string; active?: boolean; history?: Array<{ plannedStartDate: string; actualStartDate: string; active?: boolean }> }
  personId?: string
  previousApplicationId?: string
  source?: string
  resumeUrl?: string
  portfolioUrl?: string
  followUps?: Array<{ id: string; label: string; dueDate: string; done: boolean; active?: boolean }>
}

export interface MoveApplicantStageRequest {
  actor?: ApplicantOwner
  overrideReason?: string
  stage: ApplicantStage
  transitionAt?: string
  correction?: boolean
  rejectionReason?: string
  rejectionMemo?: string
}

export interface SubmitApplicantFeedbackRequest {
  reviewer: ApplicantOwner
  score: number
  comment: string
  correctionReason?: string
  actor?: ApplicantOwner
}

export interface ApiErrorBody {
  code: 'MOCK_FAILURE' | 'NOT_FOUND' | 'INVALID_STAGE' | 'INVALID_TRANSITION' | 'INVALID_EVALUATION' | 'INVALID_BODY'
  message: string
}

export interface ApplicantIntake {
  name: string
  email: string
  phone: string
  positionId: string
  source: string
  linkedApplicationId?: string
}

export const SCHEDULE_STATUS_LABELS = { PLANNED: '예정', CONFIRMED: '확정', COMPLETED: '실시', POSTPONED: '연기', CANCELLED: '취소', NO_SHOW: '노쇼' } as const
export const LIFECYCLE_LABELS = { ACTIVE: '진행', ON_HOLD: '보류', WITHDRAWN: '철회', OFFER_DECLINED: '오퍼 거절' } as const
export const OFFER_STATUS_LABELS = { DRAFT: '작성 중', SENT: '제안 완료', ACCEPTED: '지원자 수락', DECLINED: '지원자 거절' } as const
