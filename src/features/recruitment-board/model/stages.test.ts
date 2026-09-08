import { expect, test } from 'vitest'
import { applyStageTransition, canTransitionTo, getAllowedNextStages, getForwardActionLabel, getLocalDateString } from './stages'

test.each([
  ['DOCUMENT_REVIEW', ['INTERVIEW', 'REJECTED']],
  ['INTERVIEW', ['OFFER', 'REJECTED']],
  ['OFFER', ['HIRED', 'REJECTED']],
  ['HIRED', []],
  ['REJECTED', []],
] as const)('allows only the next stages from %s', (currentStage, expectedStages) => {
  expect(getAllowedNextStages(currentStage)).toEqual(expectedStages)
})

test('rejects skipped, previous, and terminal-stage moves', () => {
  expect(canTransitionTo('DOCUMENT_REVIEW', 'OFFER')).toBe(false)
  expect(canTransitionTo('INTERVIEW', 'DOCUMENT_REVIEW')).toBe(false)
  expect(canTransitionTo('HIRED', 'REJECTED')).toBe(false)
  expect(canTransitionTo('REJECTED', 'INTERVIEW')).toBe(false)
})

test('derives destination action labels from the ordered stage policy', () => {
  expect(getForwardActionLabel('DOCUMENT_REVIEW')).toBe('면접 집행')
  expect(getForwardActionLabel('INTERVIEW')).toBe('처우 협의')
  expect(getForwardActionLabel('OFFER')).toBe('최종 합격')
})

test('formats a local date without making pure calendar transforms depend on the clock', () => {
  expect(getLocalDateString(new Date(2026, 8, 8, 23, 59))).toBe('2026-09-08')
})

test('updates stage, next action, timeline, and rejection details as one transition', () => {
  const applicant = {
    id: 'applicant-1', name: '김민지', role: 'Frontend Developer' as const,
    appliedAt: '2026-08-01T09:00:00.000Z', stage: 'INTERVIEW' as const,
    email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3,
    skills: ['React'], note: '', nextAction: '인터뷰 준비',
    timeline: [{ id: 'initial', at: '2026-09-01', label: '지원서 접수' }],
  }

  const updated = applyStageTransition(applicant, 'REJECTED', '2026-09-08', {
    rejectionReason: '경력 요건 불일치', rejectionMemo: '유사 포지션을 추후 검토',
  })

  expect(updated).toMatchObject({ stage: 'REJECTED', nextAction: undefined, rejectionReason: '경력 요건 불일치', rejectionMemo: '유사 포지션을 추후 검토' })
  expect(updated.timeline).toHaveLength(2)
  expect(updated.timeline?.[1]).toMatchObject({ at: '2026-09-08', label: '면접 → 불합격' })
  expect(applicant.stage).toBe('INTERVIEW')
})
