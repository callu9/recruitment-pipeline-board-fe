import { afterEach, describe, expect, test, vi } from 'vitest'
import { STORAGE_KEY, loadApplicants } from './mockDb'

const validApplicant = {
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
  vi.restoreAllMocks()
})

describe('loadApplicants', () => {
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
