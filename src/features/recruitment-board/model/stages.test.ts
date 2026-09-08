import { expect, test } from 'vitest'
import {
  applyStageTransition,
  canTransitionTo,
  getAllowedNextStages,
  getCurrentStageEvaluation,
  getForwardActionLabel,
  getLocalDateString,
  submitApplicantEvaluation,
} from './stages'

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

test('maps the active stage to its evaluation', () => {
  const applicant = {
    id: 'applicant-1', name: '김민지', role: 'Frontend Developer' as const,
    appliedAt: '2026-08-01T09:00:00.000Z', stage: 'DOCUMENT_REVIEW' as const,
    email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3,
    skills: ['React'], note: '', owner: '김하나' as const,
    evaluations: [{
      id: 'screen-1', type: 'SCREEN' as const, status: 'PENDING' as const,
      dueDate: '2026-09-08', reviewer: '김하나' as const,
    }],
  }

  expect(getCurrentStageEvaluation(applicant)?.id).toBe('screen-1')
})

test('submits feedback without mutating the source applicant', () => {
  const applicant = {
    id: 'applicant-1', name: '김민지', role: 'Frontend Developer' as const,
    appliedAt: '2026-08-01T09:00:00.000Z', stage: 'DOCUMENT_REVIEW' as const,
    email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3,
    skills: ['React'], note: '', owner: '김하나' as const,
    evaluations: [{
      id: 'screen-1', type: 'SCREEN' as const, status: 'PENDING' as const,
      dueDate: '2026-09-08', reviewer: '김하나' as const,
    }],
    timeline: [],
  }

  const updated = submitApplicantEvaluation(applicant, 'screen-1', {
    reviewer: '이서준', score: 85, comment: '  고객 관점의 설명이 명확합니다.  ',
  }, '2026-09-08')

  expect(updated.evaluations?.[0]).toMatchObject({
    status: 'SUBMITTED', reviewer: '이서준', score: 85,
    comment: '고객 관점의 설명이 명확합니다.', submittedAt: '2026-09-08',
  })
  expect(updated.timeline?.at(-1)?.label).toBe('서류검토 피드백 작성')
  expect(applicant.evaluations[0]?.status).toBe('PENDING')
})

test('creates one pending evaluation when entering an active stage', () => {
  const applicant = {
    id: 'applicant-1', name: '김민지', role: 'Frontend Developer' as const,
    appliedAt: '2026-08-01T09:00:00.000Z', stage: 'DOCUMENT_REVIEW' as const,
    email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3,
    skills: ['React'], note: '', owner: '김하나' as const,
    schedule: {
      date: '2026-09-10', startTime: '10:00', endTime: '11:00',
      format: 'VIDEO' as const, interviewer: '이서준',
    },
    evaluations: [{
      id: 'screen-1', type: 'SCREEN' as const, status: 'SUBMITTED' as const,
      dueDate: '2026-09-08', reviewer: '김하나' as const, score: 85,
      comment: '진행 가능', submittedAt: '2026-09-08',
    }],
    timeline: [],
  }

  const updated = applyStageTransition(applicant, 'INTERVIEW', '2026-09-08')

  expect(updated.evaluations?.filter(({ type }) => type === 'INTERVIEW')).toEqual([
    expect.objectContaining({ status: 'PENDING', reviewer: '이서준', dueDate: '2026-09-10' }),
  ])
})

test('does not reuse an interview schedule for an offer evaluation', () => {
  const applicant = {
    id: 'applicant-1', name: '김민지', role: 'Frontend Developer' as const,
    appliedAt: '2026-08-01T09:00:00.000Z', stage: 'INTERVIEW' as const,
    email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3,
    skills: ['React'], note: '', owner: '김하나' as const,
    schedule: {
      date: '2026-09-01', startTime: '10:00', endTime: '11:00',
      format: 'VIDEO' as const, interviewer: '이서준',
    },
    evaluations: [],
    timeline: [],
  }

  const updated = applyStageTransition(applicant, 'OFFER', '2026-09-08')

  expect(updated.evaluations).toEqual([
    expect.objectContaining({ type: 'FINAL', reviewer: '김하나', dueDate: '2026-09-08' }),
  ])
})

test('does not duplicate an evaluation that already exists for the target stage', () => {
  const applicant = {
    id: 'applicant-1', name: '김민지', role: 'Frontend Developer' as const,
    appliedAt: '2026-08-01T09:00:00.000Z', stage: 'DOCUMENT_REVIEW' as const,
    email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3,
    skills: ['React'], note: '', owner: '김하나' as const,
    evaluations: [{
      id: 'interview-1', type: 'INTERVIEW' as const, status: 'PENDING' as const,
      dueDate: '2026-09-10', reviewer: '이서준' as const,
    }],
    timeline: [],
  }

  const updated = applyStageTransition(applicant, 'INTERVIEW', '2026-09-08')

  expect(updated.evaluations?.filter(({ type }) => type === 'INTERVIEW')).toHaveLength(1)
})
