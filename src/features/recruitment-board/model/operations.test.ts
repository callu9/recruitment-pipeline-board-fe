import { expect, test } from 'vitest'
import { createSeedApplicants, SEED_POSITIONS } from '../../../mocks/seedApplicants'
import { applyApplicantOperation, contactVersion, getAssignmentStatus, withCurrentAssignmentChecks, getCriteriaScoreIssue, getEvaluationCriteria, getTransitionIssues } from './operations'
import { applyStageTransition, getCurrentStageEvaluation, submitApplicantEvaluation } from './stages'
import { getCalendarEvents, getWorkDueDates, getMissingEvaluations, getTodayActionableApplicants } from './workspaceSelectors'
import type { Applicant } from './applicant.types'

const source = () => createSeedApplicants(2, '2026-10-07')[1]!
test('saves schedule revisions and excludes cancelled work', () => {
  const first = applyApplicantOperation(source(), { kind: 'schedule', schedule: { date: '2026-10-30', startTime: '10:00', endTime: '11:00', format: 'VIDEO', interviewer: '김하나', status: 'CONFIRMED', round: 1 } }, '김하나', '2026-10-07')
  const updated = applyApplicantOperation(first, { kind: 'schedule', schedule: { ...first.schedule!, status: 'CANCELLED' } }, '이서준', '2026-10-08')
  expect(updated.schedule?.history?.at(-1)?.status).toBe('CONFIRMED')
  expect(updated.schedule?.active).toBe(false)
  expect(updated.timeline?.at(-1)?.actor).toBe('이서준')
})
test('rejects malformed dates and backwards time ranges', () => {
  expect(() => applyApplicantOperation(source(), { kind: 'schedule', schedule: { date: '2026-02-30', startTime: '11:00', endTime: '10:00', format: 'VIDEO', interviewer: '김하나' } }, '김하나', '2026-10-07')).toThrow()
})
test('returns progress warnings consistently without blocking existing applicants in closed positions', () => {
  expect(getTransitionIssues({ ...source(), evaluations: [], schedule: null }, 'OFFER', SEED_POSITIONS).warnings).toHaveLength(2)
  expect(getTransitionIssues({ ...source(), positionId: 'position-qa' }, 'OFFER', SEED_POSITIONS).blockers).toEqual([])
})

test('saves validated profile and work details without losing schedule or evaluation history', () => {
  const updated = applyApplicantOperation(source(), { kind: 'profile', name: '새 이름', email: 'new@example.com', phone: '010', resumeUrl: 'https://example.com/resume', portfolioUrl: '', source: '추천' }, '김하나', '2026-10-07')
  expect(updated.name).toBe('새 이름')
  expect(updated.resumeUrl).toBe('https://example.com/resume')
  expect(updated.schedule).toEqual(source().schedule)
  expect(() => applyApplicantOperation(source(), { kind: 'profile', name: '새 이름', email: 'bad', phone: '010', resumeUrl: 'javascript:alert(1)', portfolioUrl: '', source: '추천' }, '김하나', '2026-10-07')).toThrow()
})
test('retains assignment and appends authored notes', () => {
  const updated = applyApplicantOperation(source(), { kind: 'work', owner: '박민지', dueDate: '2026-10-20', nextAction: '면접 준비', note: '새 메모' }, '이서준', '2026-10-07')
  expect(updated.owner).toBe('박민지')
  expect(updated.notes?.at(-1)).toMatchObject({ author: '이서준', text: '새 메모' })
})

test('records contact completion and a dated follow-up', () => {
  const updated = applyApplicantOperation(source(), { kind: 'contact', channel: '이메일', content: '면접 안내', date: '2026-10-07', status: 'DONE', reply: '확인', followUpDate: '2026-10-10' }, '김하나', '2026-10-07')
  expect(updated.contacts?.at(-1)).toMatchObject({ status: 'DONE', reply: '확인' })
  expect(updated.followUps?.at(-1)?.dueDate).toBe('2026-10-10')
})
test('preserves earlier offer conditions and distinguishes acceptance from actual start', () => {
  const proposed = applyApplicantOperation(source(), { kind: 'offer', conditions: '연봉 5000', proposedAt: '2026-10-07', responseDueDate: '2026-10-15', status: 'SENT', reason: '' }, '김하나', '2026-10-07')
  const accepted = applyApplicantOperation(proposed, { kind: 'offer', conditions: '연봉 5500', proposedAt: '2026-10-08', responseDueDate: '2026-10-16', status: 'ACCEPTED', reason: '조건 변경' }, '김하나', '2026-10-08')
  expect(accepted.offer?.history?.[0].conditions).toBe('연봉 5000')
  expect(accepted.employment?.actualStartDate).toBeUndefined()
  expect(() => applyApplicantOperation(accepted, { kind: 'employment', plannedStartDate: '', actualStartDate: '2026-10-10' }, '김하나', '2026-10-10')).toThrow()
})
test('retires planned start and leaves notification work when an offer is declined', () => {
  const updated = applyApplicantOperation({ ...source(), stage: 'HIRED', employment: { plannedStartDate: '2026-10-20', actualStartDate: '' }, followUps: [{ id: 'handoff-old', label: '입사 인계', dueDate: '2026-10-20', done: false }] }, { kind: 'offer', conditions: '연봉 5000', proposedAt: '2026-10-07', responseDueDate: '2026-10-15', status: 'DECLINED', reason: '다른 제안 선택' }, '김하나', '2026-10-07')
  expect(updated.employment).toMatchObject({ plannedStartDate: '2026-10-20', active: false })
  expect(updated.followUps?.find(({ id }) => id === 'handoff-old')?.active).toBe(false)
  expect(updated.followUps?.at(-1)).toMatchObject({ label: '종료 확인 통보', done: false })
})
test('blocks suspended and archived applicants, resumes without changing stage, and requires deletion confirmation', () => {
  const held = applyApplicantOperation(source(), { kind: 'lifecycle', status: 'ON_HOLD', reason: '일정 연기' }, '김하나', '2026-10-07')
  expect(getTransitionIssues(held, 'OFFER', SEED_POSITIONS).blockers).toHaveLength(1)
  const resumed = applyApplicantOperation(held, { kind: 'lifecycle', status: 'ACTIVE', reason: '재개' }, '김하나', '2026-10-08')
  expect(resumed.stage).toBe(source().stage)
  expect(() => applyApplicantOperation(resumed, { kind: 'delete', confirmation: 'bad', reason: '요청' }, '김하나', '2026-10-08')).toThrow()
})

test('schedules a fresh reevaluation while retaining submitted evidence', () => {
  const original = { ...source(), evaluations: [{ id: 'old', type: 'INTERVIEW' as const, status: 'SUBMITTED' as const, reviewer: '김하나' as const, dueDate: '2026-10-07', score: 80, comment: '기존 근거' }] }
  const updated = applyApplicantOperation(original, { kind: 'evaluation-plan', evaluationId: 'old', reviewer: '박민지', dueDate: '2026-10-20', reassess: true, reason: '추가 확인' }, '이서준', '2026-10-07')
  expect(updated.evaluations).toHaveLength(2)
  expect(updated.evaluations?.[0]).toMatchObject({ status: 'SUBMITTED', comment: '기존 근거' })
  expect(updated.evaluations?.[1]).toMatchObject({ status: 'PENDING', reviewer: '박민지', dueDate: '2026-10-20' })
})

const hired = (): Applicant => ({ ...source(), stage: 'HIRED', dueDate: undefined, evaluations: [], offer: { conditions: '조건', proposedAt: '2026-10-01', responseDueDate: '2026-10-10', status: 'ACCEPTED', reason: '' }, employment: { plannedStartDate: '2026-11-01', actualStartDate: '' }, followUps: [{ id: 'handoff-old', label: '입사 인계', dueDate: '2026-10-10', done: false }] })
const terminationPaths: Array<[string, (applicant: Applicant) => Applicant]> = [
  ['withdrawal', (applicant) => applyApplicantOperation(applicant, { kind: 'lifecycle', status: 'WITHDRAWN', reason: '철회' }, '김하나', '2026-10-08')],
  ['lifecycle decline', (applicant) => applyApplicantOperation(applicant, { kind: 'lifecycle', status: 'OFFER_DECLINED', reason: '거절' }, '김하나', '2026-10-08')],
  ['offer decline', (applicant) => applyApplicantOperation(applicant, { kind: 'offer', ...applicant.offer!, status: 'DECLINED', reason: '거절' }, '김하나', '2026-10-08')],
  ['rejection correction', (applicant) => applyStageTransition(applicant, 'REJECTED', '2026-10-08', { correction: true, rejectionReason: '정정' })],
]
test.each(terminationPaths)('retires hiring work and retains evidence through %s', (_name, terminate) => {
  const ended = terminate(hired())
  expect(ended.employment).toMatchObject({ plannedStartDate: '2026-11-01', active: false })
  expect(ended.followUps?.find(({ id }) => id === 'handoff-old')?.active).toBe(false)
  expect(getCalendarEvents([ended]).some(({ type }) => type === 'START_DATE' || type === 'OFFER')).toBe(false)
  expect(getCalendarEvents([ended]).some(({ type }) => type === 'FOLLOW_UP')).toBe(true)
  expect(getWorkDueDates(ended)).toEqual(['2026-10-08'])
  expect(() => applyApplicantOperation(ended, { kind: 'employment', plannedStartDate: '2026-10-08', actualStartDate: '2026-10-08' }, '김하나', '2026-10-08')).toThrow()
})
test.each(terminationPaths)('rejects %s after actual employment without losing the start record', (_name, terminate) => {
  const employed = { ...hired(), employment: { plannedStartDate: '2026-10-01', actualStartDate: '2026-10-01' } }
  expect(() => terminate(employed)).toThrow('실제 입사')
  expect(() => applyStageTransition(employed, 'INTERVIEW', '2026-10-08', { correction: true })).toThrow('실제 입사')
  expect(getTransitionIssues(employed, 'INTERVIEW', SEED_POSITIONS).blockers).toContain('실제 입사 후에는 전형 단계를 변경할 수 없습니다.')
})
test('retires an unanswered offer after rejection and requires new acceptance and plan after resumption', () => {
  const sent = { ...hired(), stage: 'OFFER' as const, offer: { ...hired().offer!, status: 'SENT' as const } }
  const rejected = applyStageTransition(sent, 'REJECTED', '2026-10-08', { rejectionReason: '종료' })
  expect(rejected.offer).toMatchObject({ status: 'SENT', active: false })
  expect(getCalendarEvents([rejected]).some(({ type }) => type === 'OFFER')).toBe(false)
  const declined = terminationPaths[1][1](hired())
  expect(declined.offer).toMatchObject({ status: 'DECLINED', active: false })
  expect(declined.offer?.history?.at(-1)).toMatchObject({ status: 'ACCEPTED' })
  const resumed = applyApplicantOperation(declined, { kind: 'lifecycle', status: 'ACTIVE', reason: '재개' }, '김하나', '2026-10-08')
  expect(() => applyApplicantOperation(resumed, { kind: 'employment', plannedStartDate: '2026-11-01', actualStartDate: '' }, '김하나', '2026-10-08')).toThrow()
  const accepted = applyApplicantOperation(resumed, { kind: 'offer', conditions: '새 조건', proposedAt: '2026-10-08', responseDueDate: '2026-10-15', status: 'ACCEPTED', reason: '재수락' }, '김하나', '2026-10-08')
  expect(getCalendarEvents([accepted]).some(({ type }) => type === 'START_DATE')).toBe(false)
  const planned = applyApplicantOperation(accepted, { kind: 'employment', plannedStartDate: '2026-11-02', actualStartDate: '' }, '김하나', '2026-10-08')
  expect(getCalendarEvents([planned]).some(({ type, date }) => type === 'START_DATE' && date === '2026-11-02')).toBe(true)
  expect(planned.employment?.history?.at(-1)).toMatchObject({ plannedStartDate: '2026-11-01', active: false })
  const completed = { ...planned, employment: { ...planned.employment!, actualStartDate: '2026-10-08' } }
  expect(() => applyApplicantOperation(completed, { kind: 'employment', plannedStartDate: '2026-11-02', actualStartDate: '' }, '김하나', '2026-10-08')).toThrow('실제 입사')
})
test('tracks the first planned contact before follow-up and clears completed contact work', () => {
  const contact = { kind: 'contact' as const, channel: '전화', content: '확인', date: '2026-10-08', status: 'PLANNED' as const, reply: '', followUpDate: '2026-10-15' }
  const initial = applyApplicantOperation({ ...source(), stage: 'OFFER', dueDate: undefined, evaluations: [], schedule: null }, contact, '김하나', '2026-10-08')
  expect(getWorkDueDates(initial)).toEqual(['2026-10-08'])
  expect(getCalendarEvents([initial]).map(({ date }) => date)).toEqual(['2026-10-08'])
  const completedFromTask = applyApplicantOperation(initial, { kind: 'task', ...initial.followUps![0], done: true }, '김하나', '2026-10-08')
  expect(completedFromTask.contacts?.[0].status).toBe('DONE')
  expect(getWorkDueDates(completedFromTask)).toEqual(['2026-10-15'])
  const id = initial.contacts![0].id
  const done = applyApplicantOperation(initial, { ...contact, id, status: 'DONE', reply: '확인함' }, '김하나', '2026-10-08')
  expect(getWorkDueDates(done)).toEqual(['2026-10-15'])
  const followUpDone = applyApplicantOperation(done, { kind: 'task', ...done.followUps![0], done: true }, '김하나', '2026-10-15')
  expect(getWorkDueDates(followUpDone)).toEqual([])
  expect(getCalendarEvents([followUpDone])).toEqual([])
  expect(followUpDone.contacts?.[0].followUpDate).toBe('')
  const replied = applyApplicantOperation(done, { ...contact, id, status: 'DONE', reply: '재연락 불필요', followUpDate: '' }, '김하나', '2026-10-09')
  expect(getWorkDueDates(replied)).toEqual([])
})
test('does not revive legacy hiring work with missing active flags when resuming or correcting rejection', () => {
  const legacy = { ...hired(), lifecycle: 'OFFER_DECLINED' as const, lifecycleReason: '거절' }
  const resumed = applyApplicantOperation(legacy, { kind: 'lifecycle', status: 'ACTIVE', reason: '재개' }, '김하나', '2026-10-08')
  expect(resumed.offer).toMatchObject({ status: 'DECLINED', active: false })
  expect(resumed.employment?.active).toBe(false)
  expect(getCalendarEvents([resumed])).toEqual([])
  expect(() => applyApplicantOperation(resumed, { kind: 'employment', plannedStartDate: '2026-11-01', actualStartDate: '' }, '김하나', '2026-10-08')).toThrow()
  const corrected = applyStageTransition({ ...hired(), stage: 'REJECTED' }, 'OFFER', '2026-10-08', { correction: true })
  expect(corrected.offer?.active).toBe(false)
  expect(corrected.employment?.active).toBe(false)
})

test.each([false, true])('restores current evaluations on resumption through hold=%s without replacing evidence', (viaHold) => {
  const original: Applicant = { ...source(), schedule: { ...source().schedule!, status: 'COMPLETED' }, evaluations: [
    { id: 'prior', type: 'SCREEN', status: 'SUBMITTED', reviewer: '김하나', dueDate: '2026-10-01', score: 90, comment: '서류 근거', active: false },
    { id: 'round-1', type: 'INTERVIEW', round: 1, status: 'SUBMITTED', reviewer: '김하나', dueDate: '2026-10-07', score: 80, comment: '면접 근거', active: true },
    { id: 'round-2', type: 'INTERVIEW', round: 2, status: 'PENDING', reviewer: '김하나', dueDate: '2026-10-08', active: true },
  ] }
  const lifecycle = (applicant: Applicant, status: 'WITHDRAWN' | 'ON_HOLD' | 'ACTIVE') => applyApplicantOperation(applicant, { kind: 'lifecycle', status, reason: '상태 확인' }, '김하나', '2026-10-08')
  const ended = lifecycle(original, 'WITHDRAWN')
  const resumed = lifecycle(viaHold ? lifecycle(ended, 'ON_HOLD') : ended, 'ACTIVE')
  expect(resumed.stage).toBe('INTERVIEW')
  expect(resumed.evaluations?.[0]).toEqual(original.evaluations![0])
  expect(resumed.evaluations?.[1]).toEqual(original.evaluations![1])
  expect(getCurrentStageEvaluation(resumed)).toMatchObject({ id: 'round-2', status: 'PENDING', active: true })
  expect(getMissingEvaluations([resumed])).toEqual([resumed])
  expect(getTodayActionableApplicants([resumed], '2026-10-08')).toEqual([resumed])
  const planned = applyApplicantOperation(resumed, { kind: 'evaluation-plan', evaluationId: 'round-2', reviewer: '박민지', dueDate: '2026-10-09', reassess: false, reason: '재배정' }, '김하나', '2026-10-08')
  expect(getCurrentStageEvaluation(planned)).toMatchObject({ reviewer: '박민지', dueDate: '2026-10-09', active: true })
  const submitted = submitApplicantEvaluation(planned, 'round-2', { reviewer: '박민지', score: 85, comment: '재개 평가 근거' }, '2026-10-09')
  expect(getMissingEvaluations([submitted])).toEqual([])
  expect(getTransitionIssues(submitted, 'OFFER', SEED_POSITIONS).warnings).toEqual([])
  expect(submitted.evaluations?.slice(0, 2)).toEqual(original.evaluations?.slice(0, 2))
})

test.each(['CANCELLED', 'POSTPONED', 'NO_SHOW'] as const)('does not restore a %s interview evaluation when resuming', (status) => {
  const scheduled = applyApplicantOperation(source(), { kind: 'schedule', schedule: { ...source().schedule!, round: 1, status } }, '김하나', '2026-10-08')
  const ended = applyApplicantOperation(scheduled, { kind: 'lifecycle', status: 'WITHDRAWN', reason: '철회' }, '김하나', '2026-10-08')
  const resumed = applyApplicantOperation(ended, { kind: 'lifecycle', status: 'ACTIVE', reason: '재개' }, '김하나', '2026-10-08')
  expect(getMissingEvaluations([resumed])).toEqual([])
  expect(resumed.schedule).toMatchObject({ status, active: false })
})

const resumePaths = [
  ['hold', ['ON_HOLD']], ['withdrawal', ['WITHDRAWN']], ['withdrawal then hold', ['WITHDRAWN', 'ON_HOLD']],
] as const
const retiredRounds = (['CANCELLED', 'POSTPONED', 'NO_SHOW'] as const).flatMap((status) => resumePaths.map(([path, stops]) => ({ status, path, stops })))
test.each(retiredRounds)('preserves $status round history after a later round is submitted and resumed via $path', ({ status, stops }) => {
  const schedule = { ...source().schedule!, date: '2026-10-08', round: 1, status }
  const retired = applyApplicantOperation({ ...source(), evaluations: [] }, { kind: 'schedule', schedule }, '김하나', '2026-10-08')
  const later = applyApplicantOperation(retired, { kind: 'schedule', schedule: { ...schedule, round: 2, status: 'COMPLETED' } }, '김하나', '2026-10-08')
  const evaluation = later.evaluations!.find(({ round }) => round === 2)!
  const completed = submitApplicantEvaluation(later, evaluation.id, { reviewer: '김하나', score: 80, comment: '후속 회차 완료' }, '2026-10-08')
  expect(getMissingEvaluations([completed])).toEqual([])
  expect(getTransitionIssues(completed, 'OFFER', SEED_POSITIONS).warnings).toEqual([])
  let stopped = completed
  for (const state of stops) stopped = applyApplicantOperation(stopped, { kind: 'lifecycle', status: state, reason: '중단' }, '김하나', '2026-10-08')
  const resumed = applyApplicantOperation(stopped, { kind: 'lifecycle', status: 'ACTIVE', reason: '재개' }, '김하나', '2026-10-08')
  expect(resumed.evaluations).toEqual(completed.evaluations)
  expect(resumed.schedule).toMatchObject({ status: 'COMPLETED', history: expect.arrayContaining([expect.objectContaining({ round: 1, status })]) })
  expect(getMissingEvaluations([resumed])).toEqual([])
  expect(getTransitionIssues(resumed, 'OFFER', SEED_POSITIONS).warnings).toEqual([])
})
test('restores all suspended pending rounds and reassessments while leaving separately retired work inactive', () => {
  const original: Applicant = { ...source(), schedule: null, evaluations: [
    { id: 'retired', type: 'INTERVIEW', round: 1, status: 'PENDING', reviewer: '김하나', dueDate: '2026-10-08', active: false },
    { id: 'pending-2', type: 'INTERVIEW', round: 2, status: 'PENDING', reviewer: '김하나', dueDate: '2026-10-08', active: true },
    { id: 'pending-3', type: 'INTERVIEW', round: 3, status: 'PENDING', reviewer: '김하나', dueDate: '2026-10-08', active: true },
    { id: 'submitted', type: 'INTERVIEW', round: 4, status: 'SUBMITTED', reviewer: '김하나', dueDate: '2026-10-08', active: true, score: 90, comment: '기존 제출' },
  ] }
  const reassessed = applyApplicantOperation(original, { kind: 'evaluation-plan', evaluationId: 'submitted', reviewer: '박민지', dueDate: '2026-10-09', reassess: true, reason: '추가 확인' }, '김하나', '2026-10-08')
  const ended = applyApplicantOperation(reassessed, { kind: 'lifecycle', status: 'WITHDRAWN', reason: '중단' }, '김하나', '2026-10-08')
  const repeated = applyApplicantOperation(ended, { kind: 'lifecycle', status: 'WITHDRAWN', reason: '중단 확인' }, '김하나', '2026-10-08')
  const resumed = applyApplicantOperation(repeated, { kind: 'lifecycle', status: 'ACTIVE', reason: '재개' }, '김하나', '2026-10-08')
  expect(resumed.evaluations).toEqual(reassessed.evaluations)
  expect(resumed.evaluations?.filter((item) => item.active && item.status === 'PENDING').map(({ id }) => id)).toEqual(['pending-2', 'pending-3', reassessed.evaluations!.at(-1)!.id])
})
test('discards restoration eligibility if a suspended round is explicitly cancelled', () => {
  const ended = applyApplicantOperation(source(), { kind: 'lifecycle', status: 'WITHDRAWN', reason: '중단' }, '김하나', '2026-10-08')
  const cancelled = applyApplicantOperation(ended, { kind: 'schedule', schedule: { ...ended.schedule!, status: 'CANCELLED' } }, '김하나', '2026-10-08')
  const resumed = applyApplicantOperation(cancelled, { kind: 'lifecycle', status: 'ACTIVE', reason: '재개' }, '김하나', '2026-10-08')
  expect(getMissingEvaluations([resumed])).toEqual([])
})
test('allows explicit reallocation of legacy inactive current evaluation without reviving unrelated evidence', () => {
  const legacy = { ...createSeedApplicants(1, '2026-10-07')[0], lifecycle: 'ACTIVE' as const }
  legacy.evaluations = legacy.evaluations?.map((item) => ({ ...item, active: false }))
  const updated = applyApplicantOperation(legacy, { kind: 'evaluation-plan', evaluationId: legacy.evaluations![0].id, reviewer: '박민지', dueDate: '2026-10-09', reassess: false, reason: '기존 종료 기록 재배정' }, '김하나', '2026-10-08')
  expect(getCurrentStageEvaluation(updated)).toMatchObject({ active: true, reviewer: '박민지' })
  expect(getMissingEvaluations([updated])).toEqual([updated])
})

test('G17: tracks assignment submission and warns before interview until it is confirmed', () => {
  const positions = SEED_POSITIONS.map((position) => position.id === source().positionId ? { ...position, assignment: '로그인 화면 구현' } : position)
  const applicant = { ...source(), stage: 'DOCUMENT_REVIEW' as const }
  expect(getTransitionIssues(applicant, 'INTERVIEW', positions).warnings).toContain('과제 제출 확인이 완료되지 않았습니다.')
  const sent = applyApplicantOperation(applicant, { kind: 'assignment', assignment: '로그인 화면 구현', dueDate: '2026-10-12', submitted: false }, '김하나', '2026-10-07', positions)
  expect(sent.followUps?.find(({ id }) => id === `assignment-${applicant.id}-${applicant.positionId}`)).toMatchObject({ dueDate: '2026-10-12', done: false, label: '과제 제출 확인 · 로그인 화면 구현' })
  const submitted = applyApplicantOperation(sent, { kind: 'assignment', assignment: '로그인 화면 구현', dueDate: '2026-10-12', submitted: true }, '김하나', '2026-10-11', positions)
  expect(submitted.followUps?.filter(({ id }) => id.startsWith('assignment-'))).toHaveLength(1)
  expect(getTransitionIssues(submitted, 'INTERVIEW', positions).warnings).not.toContain('과제 제출 확인이 완료되지 않았습니다.')
  expect(() => applyApplicantOperation(applicant, { kind: 'assignment', assignment: '로그인 화면 구현', dueDate: '2026-10-12', submitted: false }, '김하나', '2026-10-07', SEED_POSITIONS)).toThrow('과제가 없는 포지션입니다.')
})
test('G17: parses position criteria and requires one 1–5 score per criterion', () => {
  const criteria = getEvaluationCriteria({ ...SEED_POSITIONS[0]!, evaluationCriteria: ' 문제 해결\n\n협업\n문제 해결 ' })
  expect(criteria).toEqual(['문제 해결', '협업'])
  expect(getCriteriaScoreIssue([], undefined)).toBeNull()
  expect(getCriteriaScoreIssue(criteria, [{ criterion: '문제 해결', score: 4 }, { criterion: '협업', score: 5 }])).toBeNull()
  expect(getCriteriaScoreIssue(criteria, [{ criterion: '문제 해결', score: 4 }])).not.toBeNull()
  expect(getCriteriaScoreIssue(criteria, [{ criterion: '문제 해결', score: 4 }, { criterion: '협업', score: 6 }])).not.toBeNull()
  expect(getCriteriaScoreIssue(criteria, [{ criterion: '문제 해결', score: 4 }, { criterion: '문제 해결', score: 4 }])).not.toBeNull()
  expect(getCriteriaScoreIssue([], [{ criterion: '협업', score: 3 }])).not.toBeNull()
})
test('G17: keeps criterion scores on submit and in the correction history', () => {
  const applicant = source()
  const evaluation = getCurrentStageEvaluation(applicant)!
  const first = submitApplicantEvaluation(applicant, evaluation.id, { reviewer: '김하나', score: 80, comment: '근거', criteriaScores: [{ criterion: '협업', score: 4 }] }, '2026-10-07')
  const corrected = submitApplicantEvaluation(first, evaluation.id, { reviewer: '김하나', score: 90, comment: '정정', correctionReason: '오기', criteriaScores: [{ criterion: '협업', score: 5 }] }, '2026-10-08')
  const saved = corrected.evaluations!.find(({ id }) => id === evaluation.id)!
  expect(saved.criteriaScores).toEqual([{ criterion: '협업', score: 5 }])
  expect(saved.revisions?.at(-1)?.criteriaScores).toEqual([{ criterion: '협업', score: 4 }])
})
test('G17: retires a pending assignment check when the application ends', () => {
  const positions = SEED_POSITIONS.map((position) => position.id === source().positionId ? { ...position, assignment: '로그인 화면 구현' } : position)
  const sent = applyApplicantOperation({ ...source(), stage: 'DOCUMENT_REVIEW' as const }, { kind: 'assignment', assignment: '로그인 화면 구현', dueDate: '2026-10-12', submitted: false }, '김하나', '2026-10-07', positions)
  const withdrawn = applyApplicantOperation(sent, { kind: 'lifecycle', status: 'WITHDRAWN', reason: '지원 철회' }, '김하나', '2026-10-08', positions)
  expect(withdrawn.followUps?.find(({ id }) => id.startsWith('assignment-'))?.active).toBe(false)
})
test('G17 R1: an assignment completed for another position or assignment text does not count', () => {
  const withAssignment = (id: string, assignment: string) => SEED_POSITIONS.map((position) => position.id === id ? { ...position, assignment, status: 'OPEN' as const } : position)
  const other = SEED_POSITIONS.find(({ id }) => id !== source().positionId)!
  const positions = withAssignment(source().positionId!, '로그인 화면 구현').map((position) => position.id === other.id ? { ...position, assignment: '데이터 분석 과제', status: 'OPEN' as const } : position)
  const applicant = { ...source(), stage: 'DOCUMENT_REVIEW' as const }
  const done = applyApplicantOperation(applicant, { kind: 'assignment', assignment: '로그인 화면 구현', dueDate: '2026-10-12', submitted: true }, '김하나', '2026-10-07', positions)
  const moved = applyApplicantOperation(done, { kind: 'transfer', positionId: other.id, reason: '직무 변경' }, '김하나', '2026-10-08', positions)
  expect(getTransitionIssues(moved, 'INTERVIEW', positions).warnings).toContain('과제 제출 확인이 완료되지 않았습니다.')
  const changedText = positions.map((position) => position.id === source().positionId ? { ...position, assignment: '새 과제' } : position)
  expect(getTransitionIssues(done, 'INTERVIEW', changedText).warnings).toContain('과제 제출 확인이 완료되지 않았습니다.')
})
test('G17 R1: rejects assignment updates for ended applications', () => {
  const positions = SEED_POSITIONS.map((position) => position.id === source().positionId ? { ...position, assignment: '로그인 화면 구현' } : position)
  const withdrawn = applyApplicantOperation({ ...source(), stage: 'DOCUMENT_REVIEW' as const }, { kind: 'lifecycle', status: 'WITHDRAWN', reason: '지원 철회' }, '김하나', '2026-10-08', positions)
  expect(() => applyApplicantOperation(withdrawn, { kind: 'assignment', assignment: '로그인 화면 구현', dueDate: '2026-10-12', submitted: false }, '김하나', '2026-10-09', positions)).toThrow('전형을 복원·재개한 후 과제를 기록해 주세요.')
})
test('G17 R2: ordinary stage moves keep assignment work and ending keeps a completed confirmation', () => {
  const positions = SEED_POSITIONS.map((position) => position.id === source().positionId ? { ...position, assignment: '로그인 화면 구현' } : position)
  const sent = applyApplicantOperation({ ...source(), stage: 'DOCUMENT_REVIEW' as const }, { kind: 'assignment', assignment: '로그인 화면 구현', dueDate: '2026-10-12', submitted: false }, '김하나', '2026-10-07', positions)
  expect(applyStageTransition(sent, 'INTERVIEW', '2026-10-08').followUps?.find(({ id }) => id.startsWith('assignment-'))?.active).not.toBe(false)
  const done = applyApplicantOperation(sent, { kind: 'assignment', assignment: '로그인 화면 구현', dueDate: '2026-10-12', submitted: true }, '김하나', '2026-10-08', positions)
  const resumed = applyApplicantOperation(applyApplicantOperation(done, { kind: 'lifecycle', status: 'WITHDRAWN', reason: '철회' }, '김하나', '2026-10-09', positions), { kind: 'lifecycle', status: 'ACTIVE', reason: '재개' }, '김하나', '2026-10-10', positions)
  expect(getAssignmentStatus(resumed, positions)?.task?.done).toBe(true)
})
test('G17 R3: keeps assignment work when the transfer form saves the same position', () => {
  const positions = SEED_POSITIONS.map((position) => position.id === source().positionId ? { ...position, assignment: '과제 A', status: 'OPEN' as const } : position)
  const sent = applyApplicantOperation({ ...source(), stage: 'DOCUMENT_REVIEW' as const }, { kind: 'assignment', assignment: '과제 A', dueDate: '2026-10-12', submitted: false }, '김하나', '2026-10-07', positions)
  const same = applyApplicantOperation(sent, { kind: 'transfer', positionId: sent.positionId!, reason: '사유만 기록' }, '김하나', '2026-10-08', positions)
  expect(getAssignmentStatus(same, positions)?.task).toMatchObject({ done: false })
})
test('G17 R3: keeps the earlier assignment record when the assignment text changes', () => {
  const positions = SEED_POSITIONS.map((position) => position.id === source().positionId ? { ...position, assignment: '과제 A' } : position)
  const done = applyApplicantOperation({ ...source(), stage: 'DOCUMENT_REVIEW' as const }, { kind: 'assignment', assignment: '과제 A', dueDate: '2026-10-12', submitted: true }, '김하나', '2026-10-07', positions)
  const changed = positions.map((position) => position.id === source().positionId ? { ...position, assignment: '과제 B' } : position)
  const next = applyApplicantOperation(done, { kind: 'assignment', assignment: '과제 B', dueDate: '2026-10-20', submitted: false }, '김하나', '2026-10-08', changed)
  expect(next.followUps?.find(({ label }) => label === '과제 제출 확인 · 과제 A')).toMatchObject({ done: true, active: false })
  expect(getAssignmentStatus(next, changed)?.task).toMatchObject({ label: '과제 제출 확인 · 과제 B', done: false })
  expect(next.timeline?.at(-1)?.label).toContain('과제 B')
})
test('G17 R4: assignment checks are edited only through the assignment form', () => {
  const positions = SEED_POSITIONS.map((position) => position.id === source().positionId ? { ...position, assignment: '과제 A' } : position)
  const sent = applyApplicantOperation({ ...source(), stage: 'DOCUMENT_REVIEW' as const }, { kind: 'assignment', assignment: '과제 A', dueDate: '2026-10-12', submitted: true }, '김하나', '2026-10-07', positions)
  expect(() => applyApplicantOperation(sent, { kind: 'task', id: getAssignmentStatus(sent, positions)!.id, label: '과제 제출 확인 · 과제 A', dueDate: '2026-10-13', done: false }, '김하나', '2026-10-08', positions)).toThrow('과제는 과제 관리에서 기록해 주세요.')
})
test('G17 R5: a cleared or changed assignment hides only its pending check at read time and does not block archive', () => {
  const positions = SEED_POSITIONS.map((position) => position.id === source().positionId ? { ...position, assignment: '과제 A' } : position)
  const pending = { id: `assignment-${source().id}-${source().positionId}`, label: '과제 제출 확인 · 과제 A', dueDate: '2026-10-12', done: false }
  const applicant = { ...source(), followUps: [pending, { ...pending, id: 'other-task' }] }
  expect(withCurrentAssignmentChecks(applicant, positions)).toBe(applicant)
  expect(withCurrentAssignmentChecks(applicant, [])).toBe(applicant)
  const cleared = positions.map((position) => position.id === source().positionId ? { ...position, assignment: '' } : position)
  expect(withCurrentAssignmentChecks(applicant, cleared).followUps).toEqual([{ ...pending, active: false }, { ...pending, id: 'other-task' }])
  const rejected = applyStageTransition({ ...applicant, followUps: [pending] }, 'REJECTED', '2026-10-08', { rejectionReason: '역량 미달' })
  const notified = { ...rejected, followUps: rejected.followUps!.map((task) => task.id === pending.id ? { ...task, active: undefined } : { ...task, done: true }) }
  expect(() => applyApplicantOperation(notified, { kind: 'archive', archived: true, talentPool: false, reconnectDate: '', reason: '종료' }, '김하나', '2026-10-09', cleared)).not.toThrow()
})
test('G17 R5: final pass retires a pending assignment check and keeps a completed one', () => {
  const pending = { id: `assignment-${source().id}-${source().positionId}`, label: '과제 제출 확인 · 과제 A', dueDate: '2026-10-12', done: false }
  const hired = applyStageTransition({ ...source(), stage: 'OFFER' as const, followUps: [pending, { ...pending, id: `${pending.id}-history-1`, done: true }] }, 'HIRED', '2026-10-09')
  expect(hired.followUps?.slice(0, 2).map(({ active }) => active)).toEqual([false, undefined])
})
test('G17 R6: rejects an assignment confirmation made against different assignment text', () => {
  const positions = SEED_POSITIONS.map((position) => position.id === source().positionId ? { ...position, assignment: '과제 B' } : position)
  expect(() => applyApplicantOperation({ ...source(), stage: 'DOCUMENT_REVIEW' as const }, { kind: 'assignment', assignment: '과제 A', dueDate: '2026-10-12', submitted: true }, '김하나', '2026-10-07', positions)).toThrow('포지션 과제가 변경되었습니다.')
})
test('G18 R7: blocks moving an application with an actual start to another position', () => {
  const other = SEED_POSITIONS.find(({ id }) => id !== source().positionId)!
  const positions = SEED_POSITIONS.map((position) => position.id === other.id ? { ...position, status: 'OPEN' as const } : position)
  const started = { ...source(), stage: 'HIRED' as const, employment: { plannedStartDate: '2026-10-01', actualStartDate: '2026-10-01', active: true } }
  expect(() => applyApplicantOperation(started, { kind: 'transfer', positionId: other.id, reason: '재배정' }, '김하나', '2026-10-08', positions)).toThrow('실제 입사 후에는 포지션 배정을 변경할 수 없습니다.')
})
test('G18 R8: rejects an actual start date before the application date', () => {
  const hired = { ...source(), appliedAt: '2026-10-10T09:00:00.000Z', stage: 'HIRED' as const, offer: { conditions: '연봉', proposedAt: '2026-10-10', responseDueDate: '2026-10-12', status: 'ACCEPTED' as const, reason: '', active: true } }
  expect(() => applyApplicantOperation(hired, { kind: 'employment', plannedStartDate: '2026-10-09', actualStartDate: '2026-10-09' }, '김하나', '2026-10-13', SEED_POSITIONS)).toThrow('입사일은 접수일 이후여야 합니다.')
})
test('PR review P1: follow-up IDs stay unique after a completed contact removes its task', () => {
  let applicant: Applicant = { ...source(), followUps: [] }
  applicant = applyApplicantOperation(applicant, { kind: 'contact', channel: '전화', content: '안내', date: '2026-10-08', status: 'PLANNED', reply: '', followUpDate: '' }, '김하나', '2026-10-07')
  applicant = applyApplicantOperation(applicant, { kind: 'task', label: '업무 A', dueDate: '2026-10-09', done: false }, '김하나', '2026-10-07')
  const contactId = applicant.contacts!.at(-1)!.id
  applicant = applyApplicantOperation(applicant, { kind: 'contact', id: contactId, channel: '전화', content: '안내', date: '2026-10-08', status: 'DONE', reply: '확인', followUpDate: '' }, '김하나', '2026-10-08')
  applicant = applyApplicantOperation(applicant, { kind: 'task', label: '업무 B', dueDate: '2026-10-10', done: false }, '김하나', '2026-10-08')
  const ids = applicant.followUps!.map(({ id }) => id)
  expect(new Set(ids).size).toBe(ids.length)
  const a = applicant.followUps!.find(({ label }) => label === '업무 A')!
  applicant = applyApplicantOperation(applicant, { kind: 'task', id: a.id, label: '업무 A', dueDate: '2026-10-09', done: true }, '김하나', '2026-10-09')
  expect(applicant.followUps!.find(({ label }) => label === '업무 B')).toMatchObject({ dueDate: '2026-10-10', done: false })
})
test('PR review P2: stage correction keeps a cancelled interview round inactive', () => {
  let applicant: Applicant = { ...source(), stage: 'INTERVIEW', evaluations: [], schedule: null }
  applicant = applyApplicantOperation(applicant, { kind: 'schedule', schedule: { date: '2026-10-10', startTime: '10:00', endTime: '11:00', format: 'VIDEO', interviewer: '김하나', status: 'CANCELLED', round: 1 } }, '김하나', '2026-10-07')
  applicant = applyApplicantOperation(applicant, { kind: 'schedule', schedule: { date: '2026-10-11', startTime: '10:00', endTime: '11:00', format: 'VIDEO', interviewer: '김하나', status: 'COMPLETED', round: 2 } }, '김하나', '2026-10-08')
  const round2 = applicant.evaluations!.find(({ round }) => round === 2)!
  applicant = submitApplicantEvaluation(applicant, round2.id, { reviewer: '김하나', score: 80, comment: '근거' }, '2026-10-11')
  const offer = applyStageTransition(applicant, 'OFFER', '2026-10-12')
  const corrected = applyStageTransition(offer, 'INTERVIEW', '2026-10-13', { correction: true })
  expect(corrected.evaluations!.find(({ round, type }) => type === 'INTERVIEW' && round === 1)?.active).toBe(false)
})
test('PR review R4: cancelling a round retires every evaluation of that round', () => {
  let applicant: Applicant = { ...source(), stage: 'INTERVIEW', evaluations: [], schedule: null }
  applicant = applyApplicantOperation(applicant, { kind: 'schedule', schedule: { date: '2026-10-10', startTime: '10:00', endTime: '11:00', format: 'VIDEO', interviewer: '김하나', status: 'COMPLETED', round: 1 } }, '김하나', '2026-10-07')
  const first = applicant.evaluations!.find(({ round }) => round === 1)!
  applicant = submitApplicantEvaluation(applicant, first.id, { reviewer: '김하나', score: 80, comment: '근거' }, '2026-10-10')
  for (const day of ['2026-10-11', '2026-10-12']) applicant = applyApplicantOperation(applicant, { kind: 'evaluation-plan', evaluationId: first.id, reviewer: '박민지', dueDate: '2026-10-20', reassess: true, reason: '재평가' }, '김하나', day)
  applicant = applyApplicantOperation(applicant, { kind: 'schedule', schedule: { ...applicant.schedule!, status: 'CANCELLED' } }, '김하나', '2026-10-13')
  expect(applicant.evaluations!.filter(({ round, type }) => type === 'INTERVIEW' && round === 1).map(({ active }) => active)).toEqual([false, false, false])
})
test('PR review R4: cancelled rounds do not count as completed interview rounds', () => {
  const positions = SEED_POSITIONS.map((position) => position.id === source().positionId ? { ...position, requiredInterviewRounds: 2 } : position)
  let applicant: Applicant = { ...source(), stage: 'INTERVIEW', evaluations: [], schedule: null }
  applicant = applyApplicantOperation(applicant, { kind: 'schedule', schedule: { date: '2026-10-10', startTime: '10:00', endTime: '11:00', format: 'VIDEO', interviewer: '김하나', status: 'COMPLETED', round: 1 } }, '김하나', '2026-10-07')
  applicant = submitApplicantEvaluation(applicant, applicant.evaluations!.find(({ round }) => round === 1)!.id, { reviewer: '김하나', score: 80, comment: '근거' }, '2026-10-10')
  applicant = applyApplicantOperation(applicant, { kind: 'schedule', schedule: { ...applicant.schedule!, status: 'CANCELLED' } }, '김하나', '2026-10-11')
  applicant = applyApplicantOperation(applicant, { kind: 'schedule', schedule: { date: '2026-10-12', startTime: '10:00', endTime: '11:00', format: 'VIDEO', interviewer: '김하나', status: 'COMPLETED', round: 2 } }, '김하나', '2026-10-11')
  applicant = submitApplicantEvaluation(applicant, applicant.evaluations!.find(({ round }) => round === 2)!.id, { reviewer: '김하나', score: 85, comment: '근거' }, '2026-10-12')
  expect(getTransitionIssues(applicant, 'OFFER', positions).warnings).toContain('필요한 면접 회차의 평가가 완료되지 않았습니다.')
})
test('PR review R5/R6: dates of contact-linked tasks are edited only in the contact form', () => {
  let applicant: Applicant = { ...source(), followUps: [] }
  applicant = applyApplicantOperation(applicant, { kind: 'contact', channel: '전화', content: '안내', date: '2026-10-10', status: 'PLANNED', reply: '', followUpDate: '' }, '김하나', '2026-10-07')
  const contact = applicant.contacts!.at(-1)!
  const task = applicant.followUps!.find(({ id }) => id === contact.id)!
  expect(() => applyApplicantOperation(applicant, { kind: 'task', id: task.id, label: task.label, dueDate: '2026-10-12', done: false }, '김하나', '2026-10-08')).toThrow('연락에서 만든 업무의 날짜는 연락 기록에서 바꿔 주세요.')
  expect(() => applyApplicantOperation(applicant, { kind: 'task', id: task.id, label: task.label, dueDate: '2026-10-09', done: true }, '김하나', '2026-10-08')).toThrow('연락에서 만든 업무의 날짜는 연락 기록에서 바꿔 주세요.')
  const done = applyApplicantOperation(applicant, { kind: 'task', id: task.id, label: task.label, dueDate: task.dueDate, done: true }, '김하나', '2026-10-10')
  expect(done.contacts!.at(-1)).toMatchObject({ status: 'DONE', date: '2026-10-10' })
})
test('PR review final: an evaluation plan change does not reopen a cancelled interview round', () => {
  let applicant: Applicant = { ...source(), stage: 'INTERVIEW', evaluations: [], schedule: null }
  applicant = applyApplicantOperation(applicant, { kind: 'schedule', schedule: { date: '2026-10-10', startTime: '10:00', endTime: '11:00', format: 'VIDEO', interviewer: '김하나', status: 'CANCELLED', round: 1 } }, '김하나', '2026-10-07')
  const round1 = applicant.evaluations!.find(({ round }) => round === 1)!
  applicant = applyApplicantOperation(applicant, { kind: 'evaluation-plan', evaluationId: round1.id, reviewer: '박민지', dueDate: '2026-10-20', reassess: false, reason: '담당 변경' }, '김하나', '2026-10-08')
  expect(applicant.evaluations!.find(({ id }) => id === round1.id)?.active).toBe(false)
})
test('PR review R7: a contact form opened before another form completed the contact cannot overwrite it', () => {
  let applicant: Applicant = { ...source(), followUps: [] }
  applicant = applyApplicantOperation(applicant, { kind: 'contact', channel: '전화', content: '안내', date: '2026-10-10', status: 'PLANNED', reply: '', followUpDate: '' }, '김하나', '2026-10-07')
  const contact = applicant.contacts!.at(-1)!
  const base = contactVersion(contact)
  const task = applicant.followUps!.find(({ id }) => id === contact.id)!
  applicant = applyApplicantOperation(applicant, { kind: 'task', id: task.id, label: task.label, dueDate: task.dueDate, done: true }, '김하나', '2026-10-10')
  expect(() => applyApplicantOperation(applicant, { kind: 'contact', id: contact.id, base, channel: '전화', content: '안내', date: '2026-10-10', status: 'PLANNED', reply: '회신', followUpDate: '' }, '김하나', '2026-10-11')).toThrow('다른 화면에서 이 연락이 바뀌었습니다.')
  const current = applicant.contacts!.at(-1)!
  expect(applyApplicantOperation(applicant, { kind: 'contact', id: contact.id, base: contactVersion(current), channel: '전화', content: '안내', date: '2026-10-10', status: 'DONE', reply: '회신', followUpDate: '' }, '김하나', '2026-10-11').contacts!.at(-1)).toMatchObject({ status: 'DONE', reply: '회신' })
})
