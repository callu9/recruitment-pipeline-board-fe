import { expect, test } from 'vitest'
import type { Applicant } from './applicant.types'
import { groupApplicantsByStage } from './applicantSelectors'

const applicants: Applicant[] = [
  {
    id: 'applicant-1',
    name: '김민지',
    role: 'Frontend Developer',
    appliedAt: '2026-08-01',
    stage: 'DOCUMENT_REVIEW',
    email: 'minji@example.com',
    phone: '010-0000-0001',
    experienceYears: 3,
    skills: ['React'],
    note: '',
  },
  {
    id: 'applicant-2',
    name: '이준호',
    role: 'Product Manager',
    appliedAt: '2026-08-02',
    stage: 'HIRED',
    email: 'junho@example.com',
    phone: '010-0000-0002',
    experienceYears: 5,
    skills: ['Planning'],
    note: '',
  },
]

test('groups every applicant once under its stage and keeps empty stages', () => {
  const grouped = groupApplicantsByStage(applicants)

  expect(grouped.DOCUMENT_REVIEW).toEqual([applicants[0]])
  expect(grouped.INTERVIEW).toEqual([])
  expect(grouped.OFFER).toEqual([])
  expect(grouped.HIRED).toEqual([applicants[1]])
  expect(grouped.REJECTED).toEqual([])
  expect(Object.values(grouped).flat()).toHaveLength(2)
  expect(applicants.map(({ stage }) => stage)).toEqual(['DOCUMENT_REVIEW', 'HIRED'])
})
