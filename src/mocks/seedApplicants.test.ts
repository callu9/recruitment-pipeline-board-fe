import { describe, expect, test } from 'vitest'
import { createSeedApplicants } from './seedApplicants'

describe('createSeedApplicants', () => {
  test('creates the same applicants for the same size', () => {
    expect(createSeedApplicants(3)).toEqual([
      expect.objectContaining({ id: 'applicant-001', stage: 'DOCUMENT_REVIEW' }),
      expect.objectContaining({ id: 'applicant-002', stage: 'INTERVIEW' }),
      expect.objectContaining({ id: 'applicant-003', stage: 'OFFER' }),
    ])
    expect(createSeedApplicants(240)).toEqual(createSeedApplicants(240))
  })
})
