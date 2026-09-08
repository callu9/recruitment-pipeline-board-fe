import { expect, test } from 'vitest'
import type { Applicant } from './applicant.types'
import { moveApplicantOptimistically, replaceApplicant } from './applicantCache'

const firstApplicant: Applicant = {
  id: 'applicant-1',
  name: '김민지',
  role: 'Frontend Developer',
  appliedAt: '2026-08-01T09:00:00.000Z',
  stage: 'DOCUMENT_REVIEW',
  email: 'minji@example.com',
  phone: '010-0000-0001',
  experienceYears: 3,
  skills: ['React'],
  note: '',
}

const secondApplicant: Applicant = { ...firstApplicant, id: 'applicant-2', name: '이준호', stage: 'OFFER' }

test('moves only the requested applicant without changing the cached inputs', () => {
  const applicants = [firstApplicant, secondApplicant]

  const updated = moveApplicantOptimistically(applicants, firstApplicant.id, 'INTERVIEW', '2026-09-08')

  expect(updated[0]).toMatchObject({ ...firstApplicant, stage: 'INTERVIEW', nextAction: '인터뷰 일정 등록', timeline: [{ at: '2026-09-08', label: '서류검토 → 면접' }] })
  expect(applicants).toEqual([firstApplicant, secondApplicant])
  expect(updated[1]).toBe(secondApplicant)
})

test('replaces only the failed applicant with its previous entity', () => {
  const moved = { ...firstApplicant, stage: 'INTERVIEW' as const }
  const applicants = [moved, secondApplicant]

  const restored = replaceApplicant(applicants, firstApplicant)

  expect(restored).toEqual([firstApplicant, secondApplicant])
  expect(restored[1]).toBe(secondApplicant)
})
