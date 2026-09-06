import type {
  Applicant,
  ApplicantRole,
  ApplicantStage,
  Position,
} from './applicant.types'

export const WORKSPACE_TODAY = '2026-09-07'

function localDateValue(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

export function getWorkspaceWeekDays(today = WORKSPACE_TODAY) {
  const [year, month, date] = today.split('-').map(Number)
  const start = new Date(year, month - 1, date)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return localDateValue(day)
  })
}

export interface WorkspaceFilters {
  name: string
  role: ApplicantRole | 'ALL'
  owner: string
  stage: ApplicantStage | 'ALL'
  noSchedule: boolean
  overdue: boolean
  positionId: string
}

export interface CalendarEvent {
  id: string
  applicantId: string
  applicantName: string
  role: ApplicantRole
  owner: string
  date: string
  time: string
  type: 'INTERVIEW' | 'EVALUATION' | 'OFFER' | 'START_DATE'
  label: string
}

const TERMINAL_STAGES: ApplicantStage[] = ['HIRED', 'REJECTED']

export function isOverdue(applicant: Applicant, today = WORKSPACE_TODAY) {
  return Boolean(applicant.dueDate && applicant.dueDate < today && !TERMINAL_STAGES.includes(applicant.stage))
}

export function hasPendingEvaluation(applicant: Applicant) {
  return (applicant.evaluations ?? []).some((evaluation) => evaluation.status === 'PENDING')
}

export function filterWorkspaceApplicants(applicants: Applicant[], filters: WorkspaceFilters) {
  const name = filters.name.trim().toLowerCase()
  return applicants.filter((applicant) => {
    if (name && !applicant.name.toLowerCase().includes(name)) return false
    if (filters.role !== 'ALL' && applicant.role !== filters.role) return false
    if (filters.owner !== 'ALL' && applicant.owner !== filters.owner) return false
    if (filters.stage !== 'ALL' && applicant.stage !== filters.stage) return false
    if (filters.positionId && applicant.positionId !== filters.positionId) return false
    if (filters.noSchedule && applicant.schedule) return false
    if (filters.overdue && !isOverdue(applicant)) return false
    return true
  })
}

export function getStageCounts(applicants: Applicant[]) {
  return applicants.reduce<Record<ApplicantStage, number>>((counts, applicant) => {
    counts[applicant.stage] += 1
    return counts
  }, { DOCUMENT_REVIEW: 0, INTERVIEW: 0, OFFER: 0, HIRED: 0, REJECTED: 0 })
}

export function getTodayInterviews(applicants: Applicant[], today = WORKSPACE_TODAY) {
  return applicants.filter((applicant) => applicant.schedule?.date === today)
}

export function getMissingEvaluations(applicants: Applicant[]) {
  return applicants.filter(hasPendingEvaluation)
}

export function getUnscheduledApplicants(applicants: Applicant[]) {
  return applicants.filter((applicant) => applicant.stage === 'INTERVIEW' && !applicant.schedule)
}

export function getCalendarEvents(applicants: Applicant[]): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (const applicant of applicants) {
    const owner = applicant.owner ?? '미지정'
    if (applicant.schedule) {
      events.push({
        id: `${applicant.id}-interview`, applicantId: applicant.id, applicantName: applicant.name,
        role: applicant.role, owner, date: applicant.schedule.date, time: applicant.schedule.startTime,
        type: 'INTERVIEW', label: `인터뷰 · ${applicant.schedule.format === 'VIDEO' ? '화상' : '대면'}`,
      })
    }
    for (const evaluation of applicant.evaluations ?? []) {
      events.push({
        id: evaluation.id, applicantId: applicant.id, applicantName: applicant.name,
        role: applicant.role, owner: evaluation.reviewer, date: evaluation.dueDate, time: '09:00',
        type: 'EVALUATION', label: `평가 · ${evaluation.status === 'PENDING' ? '대기' : '완료'}`,
      })
    }
    if (applicant.stage === 'OFFER' && applicant.dueDate) {
      events.push({
        id: `${applicant.id}-offer`, applicantId: applicant.id, applicantName: applicant.name,
        role: applicant.role, owner, date: applicant.dueDate, time: '17:00', type: 'OFFER', label: '처우안 마감',
      })
    }
    if (applicant.stage === 'HIRED' && applicant.dueDate) {
      events.push({
        id: `${applicant.id}-start`, applicantId: applicant.id, applicantName: applicant.name,
        role: applicant.role, owner, date: applicant.dueDate, time: '09:00', type: 'START_DATE', label: '입사 예정일',
      })
    }
  }
  return events.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
}

export function getPositionSummaries(positions: Position[], applicants: Applicant[]) {
  return positions.map((position) => {
    const matching = applicants.filter((applicant) => applicant.positionId === position.id)
    return {
      ...position,
      applicantCount: matching.length,
      hiredCount: matching.filter((applicant) => applicant.stage === 'HIRED').length,
      activeCount: matching.filter((applicant) => !TERMINAL_STAGES.includes(applicant.stage)).length,
    }
  })
}
