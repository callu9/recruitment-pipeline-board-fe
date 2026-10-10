import { APPLICANT_OWNERS, SCHEDULE_STATUS_LABELS, LIFECYCLE_LABELS, OFFER_STATUS_LABELS, type Applicant, type ApplicantOwner, type ApplicantStage, type ApplicantIntake, type InterviewSchedule, type Position } from './applicant.types'
import { canRecordEmployment, getStageTransitionBlockers, retireRecruitmentWork, getCurrentStageEvaluation, getLocalDateString, STAGE_EVALUATION_TYPES, isTerminalStage } from './stages'

export type ApplicantOperation = { kind: 'schedule'; schedule: InterviewSchedule }
  | { kind: 'profile'; name: string; email: string; phone: string; resumeUrl: string; portfolioUrl: string; source: string }
  | { kind: 'evaluation-plan'; evaluationId: string; reviewer: ApplicantOwner; dueDate: string; reassess: boolean; reason: string }
  | { kind: 'contact'; id?: string; channel: string; content: string; date: string; status: 'PLANNED' | 'DONE'; reply: string; followUpDate: string }
  | { kind: 'offer'; conditions: string; proposedAt: string; responseDueDate: string; status: NonNullable<Applicant['offer']>['status']; reason: string }
  | { kind: 'employment'; plannedStartDate: string; actualStartDate: string }
  | { kind: 'lifecycle'; status: NonNullable<Applicant['lifecycle']>; reason: string }
  | { kind: 'task'; id?: string; label: string; dueDate: string; done: boolean }
  | { kind: 'archive'; archived: boolean; talentPool: boolean; reconnectDate: string; reason: string }
  | { kind: 'delete'; confirmation: string; reason: string }
  | { kind: 'transfer'; positionId: string; reason: string }
  | { kind: 'work'; owner: ApplicantOwner; dueDate: string; nextAction: string; note: string }

export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}
export function requiredText(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}을 입력해 주세요.`)
}
export function applyApplicantOperation(applicant: Applicant, operation: ApplicantOperation, actor: ApplicantOwner, at: string, positions: Position[] = []): Applicant {
  if (!operation || typeof operation !== 'object' || !APPLICANT_OWNERS.includes(actor)) throw new Error('올바른 작업과 처리자를 선택해 주세요.')
  const log = (updated: Applicant, label: string): Applicant => ({ ...updated, timeline: [...(applicant.timeline ?? []), { id: `operation-${applicant.id}-${(applicant.timeline ?? []).length + 1}`, at, actor, label }] })
  if (operation.kind === 'profile') {
    validateProfile(operation)
    return log({ ...applicant, personId: personKey(applicant), name: operation.name.trim(), email: operation.email.trim(), phone: operation.phone.trim(), resumeUrl: operation.resumeUrl.trim(), portfolioUrl: operation.portfolioUrl.trim(), source: operation.source.trim() }, '지원 정보·자료 수정')
  }
  if (operation.kind === 'work') {
    if (!APPLICANT_OWNERS.includes(operation.owner) || (operation.dueDate && !validDate(operation.dueDate)) || typeof operation.nextAction !== 'string' || typeof operation.note !== 'string') throw new Error('담당 업무 입력을 확인해 주세요.')
    return log({ ...applicant, owner: operation.owner, dueDate: operation.dueDate, nextAction: operation.nextAction.trim(), notes: [...(applicant.notes ?? []), ...(operation.note.trim() ? [{ id: `note-${applicant.id}-${(applicant.notes ?? []).length + 1}`, author: actor, createdAt: at, text: operation.note.trim() }] : [])] }, '담당자·업무 변경')
  }
  if (operation.kind === 'evaluation-plan') {
    requiredText(operation.reason, '평가 계획 변경 사유')
    if (!APPLICANT_OWNERS.includes(operation.reviewer) || !validDate(operation.dueDate) || typeof operation.reassess !== 'boolean') throw new Error('평가 담당자·기한을 확인해 주세요.')
    const evaluation = applicant.evaluations?.find(({ id }) => id === operation.evaluationId)
    if (!evaluation) throw new Error('평가를 찾을 수 없습니다.')
    if (operation.reassess && evaluation.status !== 'SUBMITTED') throw new Error('기존 평가를 제출한 후 재평가를 등록해 주세요.')
    if (!operation.reassess && evaluation.status === 'SUBMITTED') throw new Error('제출된 평가는 재평가 또는 사유를 남긴 정정을 사용해 주세요.')
    const next = { ...evaluation, reviewer: operation.reviewer, dueDate: operation.dueDate }
    if (!applicant.archivedAt && (!applicant.lifecycle || applicant.lifecycle === 'ACTIVE') && evaluation.type === STAGE_EVALUATION_TYPES[applicant.stage]) next.active = true
    return log({ ...applicant, evaluations: operation.reassess ? [...(applicant.evaluations ?? []), { id: `reevaluation-${applicant.id}-${applicant.evaluations!.length + 1}`, type: evaluation.type, round: evaluation.round, status: 'PENDING', reviewer: operation.reviewer, dueDate: operation.dueDate, active: STAGE_EVALUATION_TYPES[applicant.stage] === evaluation.type }] : applicant.evaluations!.map((item) => item.id === evaluation.id ? next : item) }, `평가 ${operation.reassess ? '재평가 등록' : '계획 변경'} · ${operation.reason}`)
  }
  if (operation.kind === 'contact') {
    requiredText(operation.channel, '연락 채널'); requiredText(operation.content, '연락 내용')
    if (!validDate(operation.date) || (operation.followUpDate && (!validDate(operation.followUpDate) || operation.followUpDate < operation.date)) || !['PLANNED', 'DONE'].includes(operation.status) || typeof operation.reply !== 'string') throw new Error('연락 날짜·상태·응답을 확인해 주세요.')
    const contact = { ...operation, id: operation.id || `contact-${applicant.id}-${(applicant.contacts ?? []).length + 1}`, actor }
    if (operation.id && !applicant.contacts?.some(({ id }) => id === operation.id)) throw new Error('연락 기록을 찾을 수 없습니다.')
    const followUps = (applicant.followUps ?? []).filter((task) => task.id !== contact.id)
    if (operation.followUpDate || operation.status === 'PLANNED') followUps.push({ id: contact.id, label: `${operation.status === 'PLANNED' ? '연락 예정' : '재연락'}: ${operation.content}`, dueDate: operation.status === 'PLANNED' ? operation.date : operation.followUpDate, done: false })
    return log({ ...applicant, contacts: operation.id ? applicant.contacts!.map((item) => item.id === contact.id ? contact : item) : [...(applicant.contacts ?? []), contact], followUps }, `수동 연락 ${operation.status} · ${operation.channel} · ${operation.content} · 응답: ${operation.reply}`)
  }
  if (operation.kind === 'offer') {
    requiredText(operation.conditions, '오퍼 조건')
    if (!validDate(operation.proposedAt) || !validDate(operation.responseDueDate) || operation.responseDueDate < operation.proposedAt || !['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED'].includes(operation.status) || typeof operation.reason !== 'string') throw new Error('오퍼 날짜·상태를 확인해 주세요.')
    if (applicant.employment?.actualStartDate && operation.status !== 'ACCEPTED') throw new Error('실제 입사 이후에는 오퍼 응답을 변경할 수 없습니다.')
    if (applicant.archivedAt || applicant.stage === 'REJECTED' || (applicant.lifecycle && applicant.lifecycle !== 'ACTIVE')) throw new Error('전형을 복원·재개한 후 새 오퍼를 기록해 주세요.')
    if (operation.status === 'DECLINED') requiredText(operation.reason, '거절 사유')
    const { history: oldHistory, ...previous } = applicant.offer ?? { conditions: operation.conditions, proposedAt: operation.proposedAt, responseDueDate: operation.responseDueDate, status: operation.status, reason: operation.reason, history: [] }
    const declined = operation.status === 'DECLINED'
    const updated: Applicant = { ...applicant, offer: { conditions: operation.conditions.trim(), proposedAt: operation.proposedAt, responseDueDate: operation.responseDueDate, status: operation.status, reason: operation.reason, active: true, history: applicant.offer ? [...(oldHistory ?? []), previous] : [] }, lifecycle: declined ? 'OFFER_DECLINED' : applicant.lifecycle, lifecycleReason: declined ? operation.reason : applicant.lifecycleReason }
    return log(declined ? retireRecruitmentWork(updated, at) : updated, `오퍼 ${OFFER_STATUS_LABELS[operation.status]} · ${operation.conditions} · ${operation.reason}`)
  }
  if (operation.kind === 'employment') {
    if (!canRecordEmployment(applicant)) throw new Error('활성 전형의 회사 최종 합격과 새 오퍼 수락을 먼저 기록해 주세요.')
    if (applicant.employment?.actualStartDate && operation.actualStartDate !== applicant.employment.actualStartDate) throw new Error('확인한 실제 입사일은 삭제·변경할 수 없습니다.')
    if (!validDate(operation.plannedStartDate) || (operation.actualStartDate && !validDate(operation.actualStartDate))) throw new Error('입사 날짜를 확인해 주세요.')
    if (operation.actualStartDate && operation.actualStartDate > getLocalDateString(at)) throw new Error('실제 입사일은 미래일 수 없습니다.')
    const { history, ...previous } = applicant.employment ?? { plannedStartDate: '', actualStartDate: '' }
    return log({ ...applicant, employment: { plannedStartDate: operation.plannedStartDate, actualStartDate: operation.actualStartDate, active: true, history: applicant.employment ? [...(history ?? []), previous] : [] } }, `입사 예정 ${operation.plannedStartDate} · 실제 ${operation.actualStartDate || '미입사'}`)
  }
  if (operation.kind === 'lifecycle') {
    requiredText(operation.reason, '상태 변경 사유')
    if (!['ACTIVE', 'ON_HOLD', 'WITHDRAWN', 'OFFER_DECLINED'].includes(operation.status)) throw new Error('지원 상태를 확인해 주세요.')
    if (applicant.employment?.actualStartDate && operation.status !== (applicant.lifecycle ?? 'ACTIVE')) throw new Error('실제 입사 후에는 지원 상태를 변경할 수 없습니다.')
    const previous = operation.status === 'ACTIVE' && ['WITHDRAWN', 'OFFER_DECLINED'].includes(applicant.lifecycle ?? '') ? retireRecruitmentWork(applicant, at, false) : applicant
    const updated = { ...previous, lifecycle: operation.status, lifecycleReason: operation.reason, followUps: (previous.followUps ?? []).map((task) => task.id.startsWith('lifecycle-result-') ? { ...task, active: false } : task) }
    if (operation.status === 'ACTIVE') updated.evaluations = previous.evaluations?.map(({ resumeOnReactivation, ...evaluation }) =>
      evaluation.type === STAGE_EVALUATION_TYPES[previous.stage] && (evaluation.active !== false || resumeOnReactivation === true) ? { ...evaluation, active: true } : evaluation)
    return log(['WITHDRAWN', 'OFFER_DECLINED'].includes(operation.status) ? retireRecruitmentWork(updated, at) : updated, `지원 상태 ${LIFECYCLE_LABELS[operation.status]} · ${operation.reason}`)
  }
  if (operation.kind === 'task') {
    requiredText(operation.label, '후속 업무')
    if (!validDate(operation.dueDate) || typeof operation.done !== 'boolean') throw new Error('업무 기한·완료 상태를 확인해 주세요.')
    const task = { id: operation.id || `task-${applicant.id}-${(applicant.followUps ?? []).length + 1}`, label: operation.label, dueDate: operation.dueDate, done: operation.done }
    if (operation.id && !applicant.followUps?.some(({ id }) => id === operation.id)) throw new Error('후속 업무를 찾을 수 없습니다.')
    const contact = applicant.contacts?.find(({ id }) => id === task.id)
    if (task.done && contact?.status === 'PLANNED') return applyApplicantOperation(applicant, { ...contact, kind: 'contact', status: 'DONE', followUpDate: contact.followUpDate ?? '' }, actor, at, positions)
    return log({ ...applicant, contacts: task.done && contact ? applicant.contacts?.map((item) => item.id === contact.id ? { ...item, followUpDate: '' } : item) : applicant.contacts, followUps: operation.id ? applicant.followUps!.map((item) => item.id === task.id ? { ...item, ...task } : item) : [...(applicant.followUps ?? []), task] }, `후속 업무 ${task.done ? '완료' : '등록'} · ${task.label}`)
  }
  if (operation.kind === 'archive') {
    requiredText(operation.reason, '보관·복원 사유')
    if (typeof operation.archived !== 'boolean' || typeof operation.talentPool !== 'boolean' || (operation.reconnectDate && !validDate(operation.reconnectDate))) throw new Error('보관 입력을 확인해 주세요.')
    if (operation.archived && !isTerminalStage(applicant.stage) && !['WITHDRAWN', 'OFFER_DECLINED'].includes(applicant.lifecycle ?? 'ACTIVE')) throw new Error('전형을 종료한 후 보관해 주세요.')
    if (operation.archived && applicant.followUps?.some((task) => task.active !== false && !task.done)) throw new Error('남은 통보·인계 업무를 완료한 후 보관해 주세요.')
    return log({ ...applicant, archivedAt: operation.archived ? at : undefined, talentPool: operation.talentPool, reconnectDate: operation.reconnectDate }, `${operation.archived ? '보관' : '복원'} · ${operation.reason}`)
  }
  if (operation.kind === 'delete') {
    requiredText(operation.reason, '삭제 사유')
    if (operation.confirmation !== applicant.id || !applicant.archivedAt) throw new Error('보관한 지원 건만 정확한 지원 건 ID를 입력해 삭제할 수 있습니다.')
    return log({ ...applicant, deletedAt: at }, `지원 건 삭제 · ${operation.reason}`)
  }
  if (operation.kind === 'transfer') {
    requiredText(operation.reason, '배정 변경 사유')
    const position = positions.find((item) => item.id === operation.positionId)
    if (!position || position.status !== 'OPEN') throw new Error('채용 중인 포지션을 선택해 주세요.')
    return log({ ...applicant, positionId: position.id, role: position.role }, `포지션 변경 ${applicant.positionId ?? '미지정'} → ${position.id} · ${operation.reason}`)
  }
  if (operation.kind !== 'schedule') throw new Error('지원하지 않는 작업입니다.')
  const schedule = operation.schedule
  if (!schedule || !validDate(schedule.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.endTime) || schedule.endTime <= schedule.startTime) throw new Error('유효한 날짜와 시작·종료 시간을 입력해 주세요.')
  requiredText(schedule.interviewer, '면접관')
  if (!['VIDEO', 'ONSITE'].includes(schedule.format) || (schedule.status && !['PLANNED', 'CONFIRMED', 'COMPLETED', 'POSTPONED', 'CANCELLED', 'NO_SHOW'].includes(schedule.status)) || (schedule.round !== undefined && (!Number.isInteger(schedule.round) || schedule.round < 1 || schedule.round > 20))) throw new Error('일정 형식·상태·회차가 올바르지 않습니다.')
  const { history: ignored, ...previous } = applicant.schedule ?? schedule
  void ignored
  const round = schedule.round ?? 1
  const active = !['COMPLETED', 'POSTPONED', 'CANCELLED', 'NO_SHOW'].includes(schedule.status ?? 'PLANNED')
  const updatedSchedule = { date: schedule.date, startTime: schedule.startTime, endTime: schedule.endTime, format: schedule.format, interviewer: schedule.interviewer.trim(), status: schedule.status ?? 'PLANNED' as const, round, active, history: applicant.schedule ? [...(applicant.schedule.history ?? []), previous] : [] }
  const evaluationId = `interview-${applicant.id}-${round}`
  const evaluations = applicant.evaluations ?? []
  const evaluation = evaluations.findLast((item) => item.type === 'INTERVIEW' && (item.round ?? 1) === round)
  return {
    ...applicant, schedule: updatedSchedule,
    nextAction: applicant.stage === 'INTERVIEW' ? (schedule.status === 'COMPLETED' ? '면접 평가 작성' : active ? '인터뷰 준비' : schedule.status === 'NO_SHOW' ? '노쇼 후속 연락' : '인터뷰 일정 등록') : applicant.nextAction,
    evaluations: [...evaluations.map((item) => item === evaluation ? { ...item, dueDate: schedule.date, resumeOnReactivation: undefined, active: applicant.stage === 'INTERVIEW' && !['CANCELLED', 'POSTPONED', 'NO_SHOW'].includes(schedule.status ?? '') } : item),
      ...(!evaluation ? [{ id: evaluationId, type: 'INTERVIEW' as const, status: 'PENDING' as const, dueDate: schedule.date, reviewer: actor, round, active: applicant.stage === 'INTERVIEW' && !['CANCELLED', 'POSTPONED', 'NO_SHOW'].includes(schedule.status ?? '') }] : [])],
    timeline: [...(applicant.timeline ?? []), { id: `operation-${applicant.id}-${(applicant.timeline ?? []).length + 1}`, at, actor, label: `면접 ${round}회차 일정 ${SCHEDULE_STATUS_LABELS[updatedSchedule.status]} · ${schedule.date} ${schedule.startTime}–${schedule.endTime}` }],
  }
}

export function getTransitionIssues(applicant: Applicant, target: ApplicantStage, positions: Position[]) {
  const warnings: string[] = []
  const blockers = getStageTransitionBlockers(applicant, target)
  const position = positions.find(({ id }) => id === applicant.positionId)
  if (applicant.stage === 'INTERVIEW' && target === 'OFFER' && getCurrentStageEvaluation(applicant)?.status === 'SUBMITTED' && new Set((applicant.evaluations ?? []).filter((evaluation) => evaluation.type === 'INTERVIEW' && evaluation.status === 'SUBMITTED').map((evaluation) => evaluation.round ?? 1)).size < (position?.requiredInterviewRounds ?? 1)) warnings.push('필요한 면접 회차의 평가가 완료되지 않았습니다.')
  if (target !== 'REJECTED' && (getCurrentStageEvaluation(applicant)?.status !== 'SUBMITTED' || applicant.evaluations?.some((evaluation) => evaluation.type === getCurrentStageEvaluation(applicant)?.type && evaluation.active !== false && evaluation.status === 'PENDING'))) warnings.push('현재 전형 평가가 완료되지 않았습니다.')
  if (applicant.stage === 'INTERVIEW' && target === 'OFFER' && applicant.schedule?.status !== 'COMPLETED') warnings.push('면접 실시 기록이 없습니다.')
  return { warnings, blockers }
}

export function validateProfile(value: { name: string; email: string; phone: string; resumeUrl?: string; portfolioUrl?: string; source: string }) {
  requiredText(value.name, '이름'); requiredText(value.email, '이메일'); requiredText(value.phone, '연락처'); requiredText(value.source, '접수 경로')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) throw new Error('이메일 형식이 올바르지 않습니다.')
  for (const link of [value.resumeUrl, value.portfolioUrl]) {
    if (link === undefined || link === '') continue
    if (typeof link !== 'string') throw new Error('자료 링크를 확인해 주세요.')
    let url: URL
    try { url = new URL(link) } catch { throw new Error('자료 링크는 https/http 주소로 입력해 주세요.') }
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('자료 링크는 https/http 주소로 입력해 주세요.')
  }
}
export function personKey(applicant: Pick<Applicant, 'email' | 'personId'>) { return applicant.personId ?? `email:${applicant.email.trim().toLowerCase()}` }

export function createApplication(input: ApplicantIntake, applicants: Applicant[], positions: Position[], actor: ApplicantOwner, id: string, at: string): Applicant {
  validateProfile(input)
  if (!APPLICANT_OWNERS.includes(actor)) throw new Error('처리자를 선택해 주세요.')
  const position = positions.find((item) => item.id === input.positionId)
  if (!position || position.status !== 'OPEN') throw new Error('채용 중인 포지션만 신규 접수를 받습니다.')
  const duplicate = applicants.find((item) => item.email.trim().toLowerCase() === input.email.trim().toLowerCase())
  const linked = applicants.find((item) => item.id === input.linkedApplicationId)
  if (duplicate && (!linked || personKey(duplicate) !== personKey(linked))) throw new Error(`동일 이메일 지원 건 ${duplicate.id}를 확인하고 연결해 주세요.`)
  if (input.linkedApplicationId && !linked) throw new Error('연결할 지원 건을 찾을 수 없습니다.')
  if (linked && linked.email.trim().toLowerCase() !== input.email.trim().toLowerCase()) throw new Error('연결한 사람의 이메일을 사용해 주세요.')
  return {
    id, personId: linked ? personKey(linked) : `person-${id}`, previousApplicationId: linked?.id,
    name: input.name.trim(), email: input.email.trim(), phone: input.phone.trim(), source: input.source.trim(), role: position.role, positionId: position.id,
    appliedAt: at, stage: 'DOCUMENT_REVIEW', experienceYears: 0, skills: [], note: '', owner: actor, dueDate: '', nextAction: '서류 검토', schedule: null, notes: [],
    evaluations: [{ id: `evaluation-${id}-screen`, type: 'SCREEN', status: 'PENDING', reviewer: actor, dueDate: getLocalDateString(at), active: true }],
    timeline: [{ id: `intake-${id}`, at, actor, toStage: 'DOCUMENT_REVIEW', label: `지원서 접수 · ${input.source.trim()}${linked ? ` · 이전 지원 ${linked.id}` : ''}` }],
  }
}
export function validatePosition(position: Position) {
  if (!position || typeof position.id !== 'string') throw new Error('포지션 ID가 올바르지 않습니다.')
  requiredText(position.title, '포지션명'); requiredText(position.department, '부서')
  if (!Number.isInteger(position.requiredCount) || position.requiredCount < 1 || !validDate(position.deadline) || !['OPEN', 'PAUSED', 'CLOSED'].includes(position.status)) throw new Error('목표·기한·상태를 확인해 주세요.')
  if (position.requiredInterviewRounds !== undefined && (!Number.isInteger(position.requiredInterviewRounds) || position.requiredInterviewRounds < 1 || position.requiredInterviewRounds > 20)) throw new Error('면접 회차는 1–20으로 입력해 주세요.')
  for (const value of [position.description, position.evaluationCriteria, position.assignment]) if (value !== undefined && typeof value !== 'string') throw new Error('포지션 설명을 확인해 주세요.')
}
