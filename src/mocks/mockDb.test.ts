import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Applicant } from '../features/recruitment-board/model/applicant.types'
import { resetMockApiTestConfig, setMockApiTestConfig } from './mockConfig'
import {
  STORAGE_KEY,
  getApplicantsStorageKey,
  loadApplicants,
  saveApplicants,
  updateApplicantStage,
} from './mockDb'

const validApplicant: Applicant = {
  id: 'applicant-001',
  name: '지원자 001',
  role: 'Frontend Developer',
  appliedAt: '2026-08-01T09:00:00.000Z',
  stage: 'DOCUMENT_REVIEW',
  email: 'applicant1@example.com',
  phone: '010-1000-1000',
  experienceYears: 3,
  skills: ['React', 'TypeScript'],
  note: 'Frontend Developer 지원자',
}

afterEach(() => {
  localStorage.clear()
  resetMockApiTestConfig()
  vi.restoreAllMocks()
})

describe('loadApplicants', () => {
  test('preserves valid stored applicants without replacing them with seed data', () => {
    const storedApplicants = [{ ...validApplicant, name: 'Saved Applicant', stage: 'INTERVIEW' as const }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedApplicants))

    expect(loadApplicants()).toEqual(storedApplicants)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toEqual(storedApplicants)
  })

  test('stores mixed seed data only when storage is empty', () => {
    const applicants = loadApplicants()

    expect(applicants.map(({ name }) => name)).toContain('Alex Kim')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toEqual(applicants)
  })

  test('isolates the 1,000 applicant mode and preserves its stage updates', () => {
    saveApplicants([{ ...validApplicant, name: 'Default mode applicant' }])
    const defaultStorage = localStorage.getItem(STORAGE_KEY)

    setMockApiTestConfig({ applicantSeedSize: 1000 })
    const performanceApplicants = loadApplicants()
    const performanceStorageKey = getApplicantsStorageKey()

    expect(performanceStorageKey).toBe(`${STORAGE_KEY}:1000`)
    expect(performanceApplicants).toHaveLength(1000)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(defaultStorage)

    updateApplicantStage('applicant-001', 'INTERVIEW')

    expect(loadApplicants().find(({ id }) => id === 'applicant-001')?.stage).toBe('INTERVIEW')
    expect(JSON.parse(localStorage.getItem(performanceStorageKey) ?? '[]')).toHaveLength(1000)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(defaultStorage)
  })

  test.each([
    ['id', { ...validApplicant, id: 1 }],
    [
      'missing name',
      {
        id: 'applicant-001',
        role: 'Frontend Developer',
        appliedAt: '2026-08-01T09:00:00.000Z',
        stage: 'DOCUMENT_REVIEW',
        email: 'applicant1@example.com',
        phone: '010-1000-1000',
        experienceYears: 3,
        skills: ['React', 'TypeScript'],
        note: 'Frontend Developer 지원자',
      },
    ],
    ['role', { ...validApplicant, role: 'Unknown Role' }],
    ['appliedAt', { ...validApplicant, appliedAt: 1 }],
    ['stage', { ...validApplicant, stage: 'UNKNOWN' }],
    ['email', { ...validApplicant, email: 1 }],
    ['phone', { ...validApplicant, phone: 1 }],
    ['experienceYears', { ...validApplicant, experienceYears: '3' }],
    ['skills', { ...validApplicant, skills: ['React', 1] }],
    ['note', { ...validApplicant, note: 1 }],
  ])('resets storage when %s is invalid', (_field, applicant) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([applicant]))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(loadApplicants()).toHaveLength(240)
    expect(warn).toHaveBeenCalled()
  })
})
