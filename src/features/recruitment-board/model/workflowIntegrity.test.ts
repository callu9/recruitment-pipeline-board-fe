import { expect, test, vi } from 'vitest'
import { createSeedApplicants } from '../../../mocks/seedApplicants'
import { applyStageTransition, submitApplicantEvaluation, getLocalDateString } from './stages'
import { createApplication } from './operations'
import { SEED_POSITIONS } from '../../../mocks/seedApplicants'
import { isOverdue, getCalendarEvents, getTodayActionableApplicants, getUnscheduledApplicants, filterWorkspaceApplicants, EMPTY_FILTERS } from './workspaceSelectors'

const source = () => createSeedApplicants(1, '2026-10-07')[0]!
test('preserves rejection rationale when correcting the decision', () => {
  const rejected = applyStageTransition(source(), 'REJECTED', '2026-10-07', { rejectionReason: '역량', rejectionMemo: '재검토 가능' })
  const corrected = applyStageTransition(rejected, 'INTERVIEW', '2026-10-08', { correction: true })
  expect(corrected.timeline?.some((event) => event.rejectionReason === '역량' && event.rejectionMemo === '재검토 가능')).toBe(true)
})
test('uses pending evaluation deadline even when applicant deadline is future', () => {
  expect(isOverdue({ ...source(), dueDate: '2026-10-20' }, '2026-10-07')).toBe(true)
})
test('retires former-stage work when advancing without deleting history', () => {
  const updated = applyStageTransition(source(), 'INTERVIEW', '2026-10-07')
  expect(updated.evaluations?.find((item) => item.type === 'SCREEN')?.active).toBe(false)
  expect(updated.dueDate).toBeUndefined()
  expect(getCalendarEvents([updated]).some((event) => event.id === source().evaluations?.[0].id)).toBe(false)
})
test('keeps terminal follow-up work visible in Today and Calendar', () => {
  const updated = applyStageTransition(source(), 'HIRED', '2026-10-07')
  expect(getTodayActionableApplicants([updated], '2026-10-07')).toEqual([updated])
  expect(getCalendarEvents([updated]).some((event) => event.type === 'FOLLOW_UP')).toBe(true)
})
test('keeps submitted feedback version when correcting an earlier stage', () => {
  const first = submitApplicantEvaluation(source(), source().evaluations![0].id, { reviewer: '김하나', score: 80, comment: '최초' }, '2026-10-07')
  const corrected = submitApplicantEvaluation(first, first.evaluations![0].id, { reviewer: '이서준', score: 60, comment: '정정' }, '2026-10-08')
  expect(corrected.evaluations?.[0].revisions?.[0].comment).toBe('최초')
})

test('does not ask to schedule an interview already completed', () => {
  const applicant = { ...source(), stage: 'INTERVIEW' as const, schedule: { date: '2026-10-07', startTime: '10:00', endTime: '11:00', format: 'VIDEO' as const, interviewer: '김하나', status: 'COMPLETED' as const, active: false } }
  expect(getUnscheduledApplicants([applicant])).toEqual([])
})
test.each(['CANCELLED', 'POSTPONED', 'NO_SHOW', 'COMPLETED', 'CONFIRMED'] as const)('uses one rescheduling policy for %s in Today and Applicants', (status) => {
  const applicant = { ...source(), stage: 'INTERVIEW' as const, schedule: { date: '2026-10-08', startTime: '10:00', endTime: '11:00', format: 'VIDEO' as const, interviewer: '김하나', status, active: !['CANCELLED', 'POSTPONED', 'NO_SHOW', 'COMPLETED'].includes(status) } }
  const expected = ['CANCELLED', 'POSTPONED', 'NO_SHOW'].includes(status) ? [applicant] : []
  expect(getUnscheduledApplicants([applicant])).toEqual(expected)
  expect(filterWorkspaceApplicants([applicant], { ...EMPTY_FILTERS, noSchedule: true })).toEqual(expected)
})
test('includes due offer responses and planned starts in Today until completed', () => {
  const offer = { ...source(), stage: 'OFFER' as const, dueDate: undefined, evaluations: [], schedule: null, offer: { conditions: '조건', proposedAt: '2026-10-01', responseDueDate: '2026-10-08', status: 'SENT' as const, reason: '' }, followUps: [] }
  const start = { ...offer, id: 'start', stage: 'HIRED' as const, offer: { ...offer.offer, status: 'ACCEPTED' as const }, employment: { plannedStartDate: '2026-10-08', actualStartDate: '' } }
  expect(getTodayActionableApplicants([offer, start], '2026-10-07')).toEqual([])
  expect(getTodayActionableApplicants([offer, start], '2026-10-08')).toEqual([offer, start])
  expect(getTodayActionableApplicants([offer, start], '2026-10-09')).toEqual([offer, start])
  expect(isOverdue(start, '2026-10-09')).toBe(true)
  expect(getTodayActionableApplicants([{ ...offer, offer: { ...offer.offer, status: 'ACCEPTED' } }, { ...start, employment: { ...start.employment, actualStartDate: '2026-10-08' } }], '2026-10-09')).toEqual([])
})
test.each([
  ['2026-10-07T14:59:59Z', '2026-10-07'],
  ['2026-10-07T15:00:00Z', '2026-10-08'],
  ['2026-10-07T15:30:00Z', '2026-10-08'],
  ['2026-10-07T23:59:59Z', '2026-10-08'],
  ['2026-10-08T00:00:00Z', '2026-10-08'],
  ['2026-10-08T15:00:00Z', '2026-10-09'],
])('uses KST intake dates across midnight and 09:00 for %s', (at, expected) => {
  vi.stubEnv('TZ', 'Asia/Seoul')
  try {
    const applicant = createApplication({ name: '날짜 검증', email: 'date@example.com', phone: '010', source: '검증', positionId: 'position-frontend' }, [], SEED_POSITIONS, '김하나', 'date-check', at)
    expect(getLocalDateString(new Date(at))).toBe(expected)
    expect(applicant.appliedAt).toBe(at)
    expect(getLocalDateString(at)).toBe(expected)
    expect(getLocalDateString(expected)).toBe(expected)
    expect(applicant.evaluations?.[0].dueDate).toBe(expected)
    expect(isOverdue(applicant, expected)).toBe(false)
  } finally { vi.unstubAllEnvs() }
})
