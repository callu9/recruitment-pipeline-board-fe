import { expect, test } from 'vitest'
import { createSeedApplicants } from '../../../mocks/seedApplicants'
import type { Applicant } from './applicant.types'
import { filterApplicants, getApplicantRoles, groupApplicantsByStage } from './applicantSelectors'

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

test('filters by a trimmed case-insensitive name query without changing the source list', () => {
  const englishNameApplicant: Applicant = { ...applicants[0], id: 'applicant-3', name: 'Alex Kim' }
  const source = [...applicants, englishNameApplicant]
  const sourceBeforeFiltering = [...source]

  expect(filterApplicants(source, { nameQuery: '  aLeX  ', role: 'ALL' })).toEqual([englishNameApplicant])
  expect(source).toEqual(sourceBeforeFiltering)
  expect(applicants).toEqual([
    expect.objectContaining({ id: 'applicant-1', name: '김민지' }),
    expect.objectContaining({ id: 'applicant-2', name: '이준호' }),
  ])
})

test('combines name and role filters and returns each current role once', () => {
  const alexDesigner: Applicant = { ...applicants[0], id: 'applicant-3', name: 'Alex Kim', role: 'Product Designer' }
  const alexDeveloper: Applicant = { ...applicants[0], id: 'applicant-4', name: 'Alex Lee' }
  const source = [...applicants, alexDesigner, alexDeveloper]

  expect(filterApplicants(source, { nameQuery: 'alex', role: 'Frontend Developer' })).toEqual([alexDeveloper])
  expect(getApplicantRoles(source)).toEqual(['Frontend Developer', 'Product Manager', 'Product Designer'])
})

test('filters and groups 1,000 applicants without losing or duplicating results', () => {
  const source = createSeedApplicants(1000)
  const filtered = filterApplicants(source, {
    nameQuery: 'alex',
    role: 'Backend Developer',
  })
  const grouped = groupApplicantsByStage(filtered)

  expect(filtered.length).toBeGreaterThan(0)
  expect(filtered.every(({ name, role }) =>
    name.toLowerCase().includes('alex') && role === 'Backend Developer')).toBe(true)
  expect(Object.values(grouped).flat().map(({ id }) => id).sort()).toEqual(
    filtered.map(({ id }) => id).sort(),
  )
})
