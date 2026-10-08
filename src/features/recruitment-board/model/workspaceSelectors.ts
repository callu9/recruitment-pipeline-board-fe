import type {
  Applicant,
  ApplicantRole,
  ApplicantStage,
  Position,
} from './applicant.types'
import { canRecordEmployment, hasActiveOffer, getLocalDateString, STAGE_EVALUATION_TYPES, isTerminalStage } from './stages'

function localDateValue(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

export { getLocalDateString }

export function getWorkspaceHeaderLabel(today = getLocalDateString()) {
  const [year, month, date] = today.split('-').map(Number)
  const value = new Date(year, month - 1, date)
  const weekday = value.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const monthLabel = value.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return `${weekday} · ${monthLabel} ${String(date).padStart(2, '0')}, ${year}`
}

export function getWorkspaceWeekDays(today = getLocalDateString()) {
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

export const EMPTY_FILTERS: WorkspaceFilters = { name: '', role: 'ALL', owner: 'ALL', stage: 'ALL', noSchedule: false, overdue: false, positionId: '' }

export type ApplicantPageSize = 20 | 50 | 100

export type ApplicantSort = 'APPLIED' | 'DUE' | 'OVERDUE'

export function sortWorkspaceApplicants(applicants: Applicant[], sort: ApplicantSort, today = getLocalDateString()) {
  const applied = (a: Applicant, b: Applicant) => b.appliedAt.localeCompare(a.appliedAt) || a.id.localeCompare(b.id)
  return [...applicants].sort((a, b) => {
    if (sort === 'APPLIED') return applied(a, b)
    const aPriority = sort === 'DUE' ? Boolean(getWorkDueDates(a).length) : isOverdue(a, today)
    const bPriority = sort === 'DUE' ? Boolean(getWorkDueDates(b).length) : isOverdue(b, today)
    return Number(bPriority) - Number(aPriority)
      || (aPriority && bPriority ? (getWorkDueDates(a)[0] ?? '').localeCompare(getWorkDueDates(b)[0] ?? '') : 0)
      || applied(a, b)
  })
}

export function paginateApplicants(applicants: Applicant[], page: number, pageSize: ApplicantPageSize) {
  const total = applicants.length
  const totalPages = Math.ceil(total / pageSize)
  const validPage = Math.min(Math.max(page, 1), Math.max(totalPages, 1))
  const start = (validPage - 1) * pageSize
  return {
    items: applicants.slice(start, start + pageSize),
    page: validPage,
    totalPages,
    total,
    from: total ? start + 1 : 0,
    to: Math.min(start + pageSize, total),
  }
}

export interface CalendarEvent {
  id: string
  applicantId: string
  applicantName: string
  role: ApplicantRole
  owner: string
  date: string
  time: string
  type: 'INTERVIEW' | 'EVALUATION' | 'OFFER' | 'START_DATE' | 'FOLLOW_UP'
  label: string
}

export function isArchiveOrTalentPool(applicant: Applicant) { return Boolean(applicant.archivedAt || applicant.talentPool) }

export function isCurrentInterviewSchedule(applicant: Applicant) {
  return isRecruiting(applicant) && applicant.stage === 'INTERVIEW' && applicant.schedule?.active !== false && Boolean(applicant.schedule)
}

export function isRecruiting(applicant: Applicant) { return !applicant.archivedAt && !isTerminalStage(applicant.stage) && (!applicant.lifecycle || applicant.lifecycle === 'ACTIVE') }

export function isActiveEvaluation(applicant: Applicant, evaluation: NonNullable<Applicant['evaluations']>[number]) {
  return isRecruiting(applicant) && evaluation.active !== false && evaluation.type === STAGE_EVALUATION_TYPES[applicant.stage]
}

export function hasActiveSchedule(applicant: Applicant) {
  return isRecruiting(applicant) && applicant.stage === 'INTERVIEW' && applicant.schedule && applicant.schedule.active !== false && !['COMPLETED', 'CANCELLED', 'NO_SHOW', 'POSTPONED'].includes(applicant.schedule.status ?? 'PLANNED')
}

export function isPendingOfferResponse(applicant: Applicant) { return hasActiveOffer(applicant) && applicant.offer?.status === 'SENT' }
export function isPendingStart(applicant: Applicant) { return canRecordEmployment(applicant) && applicant.employment?.active !== false && Boolean(applicant.employment?.plannedStartDate) && !applicant.employment?.actualStartDate }
export function isPendingFollowUp(applicant: Applicant, task: NonNullable<Applicant['followUps']>[number]) {
  return !applicant.archivedAt && task.active !== false && !task.done && (!task.id.startsWith('handoff-') || (applicant.stage === 'HIRED' && hasActiveOffer(applicant)))
}

export function getWorkDueDates(applicant: Applicant) {
  return [
    ...(isRecruiting(applicant) && applicant.dueDate ? [applicant.dueDate] : []),
    ...(applicant.evaluations ?? []).filter((evaluation) => isActiveEvaluation(applicant, evaluation) && evaluation.status === 'PENDING').map((evaluation) => evaluation.dueDate),
    ...(applicant.followUps ?? []).filter((task) => isPendingFollowUp(applicant, task)).map((task) => task.dueDate),
    ...(isPendingOfferResponse(applicant) ? [applicant.offer!.responseDueDate] : []),
    ...(isPendingStart(applicant) ? [applicant.employment!.plannedStartDate] : []),
    ...(applicant.talentPool && applicant.reconnectDate ? [applicant.reconnectDate] : []),
  ].filter(Boolean).sort()
}

export function isOverdue(applicant: Applicant, today = getLocalDateString()) {
  return getWorkDueDates(applicant).some((date) => date < today)
}

export function hasPendingEvaluation(applicant: Applicant) {
  return (applicant.evaluations ?? []).some((evaluation) => isActiveEvaluation(applicant, evaluation) && evaluation.status === 'PENDING')
}

export function filterWorkspaceApplicants(applicants: Applicant[], filters: WorkspaceFilters, today = getLocalDateString()) {
  const name = filters.name.trim().toLowerCase()
  return applicants.filter((applicant) => {
    if (name && !applicant.name.toLowerCase().includes(name)) return false
    if (filters.role !== 'ALL' && applicant.role !== filters.role) return false
    if (filters.owner !== 'ALL' && applicant.owner !== filters.owner) return false
    if (filters.stage !== 'ALL' && applicant.stage !== filters.stage) return false
    if (filters.positionId && applicant.positionId !== filters.positionId) return false
    if (filters.noSchedule && !needsInterviewSchedule(applicant)) return false
    if (filters.overdue && !isOverdue(applicant, today)) return false
    return true
  })
}

export function getStageCounts(applicants: Applicant[]) {
  return applicants.reduce<Record<ApplicantStage, number>>((counts, applicant) => {
    counts[applicant.stage] += 1
    return counts
  }, { DOCUMENT_REVIEW: 0, INTERVIEW: 0, OFFER: 0, HIRED: 0, REJECTED: 0 })
}

export function getTodayInterviews(applicants: Applicant[], today = getLocalDateString()) {
  return applicants.filter((applicant) => hasActiveSchedule(applicant) && applicant.schedule?.date === today)
}

export function getMissingEvaluations(applicants: Applicant[]) {
  return applicants.filter((applicant) => !isTerminalStage(applicant.stage) && hasPendingEvaluation(applicant))
}

export function needsInterviewSchedule(applicant: Applicant) { return isRecruiting(applicant) && applicant.stage === 'INTERVIEW' && applicant.schedule?.status !== 'COMPLETED' && !hasActiveSchedule(applicant) }
export function getUnscheduledApplicants(applicants: Applicant[]) { return applicants.filter(needsInterviewSchedule) }
export function getDueOfferResponses(applicants: Applicant[], today = getLocalDateString()) { return applicants.filter((applicant) => isPendingOfferResponse(applicant) && applicant.offer!.responseDueDate <= today) }
export function getDueStartConfirmations(applicants: Applicant[], today = getLocalDateString()) { return applicants.filter((applicant) => isPendingStart(applicant) && applicant.employment!.plannedStartDate <= today) }

export function getTodayActionableApplicants(applicants: Applicant[], today = getLocalDateString()) {
  const queued = [
    ...getTodayInterviews(applicants, today),
    ...getMissingEvaluations(applicants),
    ...applicants.filter((applicant) => isOverdue(applicant, today)),
    ...getUnscheduledApplicants(applicants),
    ...getDueOfferResponses(applicants, today),
    ...getDueStartConfirmations(applicants, today),
    ...applicants.filter((applicant) => applicant.followUps?.some((task) => isPendingFollowUp(applicant, task))),
    ...applicants.filter((applicant) => applicant.talentPool && applicant.reconnectDate && applicant.reconnectDate <= today),
  ]
  return [...new Map(queued.map((applicant) => [applicant.id, applicant])).values()]
}

export function getCalendarEvents(applicants: Applicant[]): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (const applicant of applicants) {
    if (applicant.talentPool && applicant.reconnectDate) events.push({ id: `reconnect-${applicant.id}`, applicantId: applicant.id, applicantName: applicant.name, role: applicant.role, owner: applicant.owner ?? '미지정', date: applicant.reconnectDate, time: '09:00', type: 'FOLLOW_UP', label: '인재풀 재접촉' })
    if (applicant.archivedAt) continue
    if (isPendingOfferResponse(applicant)) events.push({ id: `offer-response-${applicant.id}`, applicantId: applicant.id, applicantName: applicant.name, role: applicant.role, owner: applicant.owner ?? '미지정', date: applicant.offer!.responseDueDate, time: '17:00', type: 'OFFER', label: '오퍼 응답 기한' })
    if (isPendingStart(applicant)) events.push({ id: `start-${applicant.id}`, applicantId: applicant.id, applicantName: applicant.name, role: applicant.role, owner: applicant.owner ?? '미지정', date: applicant.employment!.plannedStartDate, time: '09:00', type: 'START_DATE', label: '입사 예정' })
    for (const task of applicant.followUps ?? []) {
      if (isPendingFollowUp(applicant, task)) events.push({ id: task.id, applicantId: applicant.id, applicantName: applicant.name, role: applicant.role, owner: applicant.owner ?? '미지정', date: task.dueDate, time: '09:00', type: 'FOLLOW_UP', label: task.label })
    }
    if (!isRecruiting(applicant)) continue
    const owner = applicant.owner ?? '미지정'
    if (hasActiveSchedule(applicant) && applicant.schedule) {
      events.push({
        id: `${applicant.id}-interview`, applicantId: applicant.id, applicantName: applicant.name,
        role: applicant.role, owner, date: applicant.schedule.date, time: applicant.schedule.startTime,
        type: 'INTERVIEW', label: `인터뷰 · ${applicant.schedule.format === 'VIDEO' ? '화상' : '대면'}`,
      })
    }
    for (const evaluation of (applicant.evaluations ?? []).filter((item) => isActiveEvaluation(applicant, item) && item.status === 'PENDING')) {
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
      activeCount: matching.filter((applicant) => isRecruiting(applicant)).length,
    }
  })
}

export function formatWorkspaceDate(value?: string) {
  return value ? getLocalDateString(value).replaceAll('-', '.') : '미정'
}

export function formatWorkspaceDueDate(value: string | undefined, active: boolean, today = getLocalDateString()) {
  const absolute = formatWorkspaceDate(value)
  if (!value || !active) return absolute
  const day = (date: string) => { const [y, m, d] = getLocalDateString(date).split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000 }
  const delta = day(value) - day(today)
  const urgency = delta === 0 ? '오늘 마감' : delta === 1 ? '내일 마감' : delta < 0 ? `${-delta}일 지연` : ''
  return urgency ? `${absolute} · ${urgency}` : absolute
}
