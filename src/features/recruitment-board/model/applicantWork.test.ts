import { expect, test } from 'vitest'
import { createSeedApplicants } from '../../../mocks/seedApplicants'
import { getApplicantWork } from './applicantWork'
const base = createSeedApplicants(1, '2026-10-07')[0]
test('routes active evaluation to feedback instead of advancing the stage', () => {
  expect(getApplicantWork(base).target).toBe('evaluation')
})
test('prioritizes missing interview schedule over interview feedback', () => {
  expect(getApplicantWork({ ...base, stage: 'INTERVIEW', schedule: null }).target).toBe('면접 일정 관리')
})
test('routes pending offer and accepted hire to their actual work', () => {
  expect(getApplicantWork({ ...base, stage: 'OFFER', evaluations: [], offer: { conditions: '조건', proposedAt: '2026-10-07', responseDueDate: '2026-10-08', status: 'SENT', reason: '' } }).target).toBe('오퍼 관리')
  expect(getApplicantWork({ ...base, stage: 'HIRED', evaluations: [], offer: { conditions: '조건', proposedAt: '2026-10-07', responseDueDate: '2026-10-08', status: 'ACCEPTED', reason: '' }, employment: { plannedStartDate: '2026-10-08', actualStartDate: '' } }).target).toBe('입사 관리')
})
test('keeps incomplete terminal followup executable and inactive work in support', () => {
  expect(getApplicantWork({ ...base, stage: 'REJECTED', evaluations: [], followUps: [{ id: 'task-1', label: '결과 통보', dueDate: '2026-10-08', done: false }] }).target).toBe('후속 업무 관리')
  expect(getApplicantWork({ ...base, lifecycle: 'ON_HOLD' }).target).toBe('지원 상태 관리')
  expect(getApplicantWork({ ...base, archivedAt: '2026-10-08' }).target).toBe('보관·복원')
})
test('keeps a withdrawn notification actionable before offering support state changes', () => {
  expect(getApplicantWork({ ...base, lifecycle: 'WITHDRAWN', followUps: [{ id: 'notification', label: '종료 통보', dueDate: '2026-10-01', done: false, active: true }] }, '2026-10-08').target).toBe('후속 업무 관리')
})
