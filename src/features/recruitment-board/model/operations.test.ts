import { expect, test } from 'vitest'
import { createSeedApplicants, SEED_POSITIONS } from '../../../mocks/seedApplicants'
import { applyApplicantOperation, getTransitionIssues } from './operations'
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
