import { describe, expect, test } from 'vitest'
import { APPLICANT_ROLES } from '../features/recruitment-board/model/applicant.types'
import { STAGES } from '../features/recruitment-board/model/stages'
import { createSeedApplicants } from './seedApplicants'

describe('createSeedApplicants', () => {
  test('includes Korean and English names in the default seed', () => {
    const names = createSeedApplicants().map(({ name }) => name)

    expect(names).toContain('김민지')
    expect(names).toContain('Alex Kim')
  })

  test('creates the same applicants for the same size', () => {
    expect(createSeedApplicants(240)).toEqual(createSeedApplicants(240))
  })

  test('preserves requested size, unique IDs, and role and stage cycles', () => {
    const applicants = createSeedApplicants(13)

    expect(applicants).toHaveLength(13)
    expect(new Set(applicants.map(({ id }) => id))).toHaveLength(13)
    expect(applicants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'applicant-001',
          role: APPLICANT_ROLES[0],
          appliedAt: '2026-08-01T09:00:00.000Z',
          stage: STAGES[0].code,
          email: 'applicant1@example.com',
          phone: '010-1000-1000',
        }),
        expect.objectContaining({
          id: 'applicant-007',
          role: APPLICANT_ROLES[0],
          appliedAt: '2026-08-07T09:00:00.000Z',
          stage: STAGES[1].code,
          email: 'applicant7@example.com',
          phone: '010-1006-1042',
        }),
      ]),
    )
  })
})
