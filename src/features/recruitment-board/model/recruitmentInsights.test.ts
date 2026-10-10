import { expect, test } from 'vitest'
import { createSeedApplicants } from '../../../mocks/seedApplicants'
import { getRecruitmentInsights } from './recruitmentInsights'
import { applyStageTransition } from './stages'

test('does not infer history from current stage counts', () => {
  const insight = getRecruitmentInsights(createSeedApplicants(30))
  expect(insight.transitions).toEqual([])
  expect(insight.hiringDays).toEqual([])
  expect(insight.measuredApplicants).toBe(0)
})
test('computes measured dwell and hiring time and separates corrections from progression', () => {
  const original = { ...createSeedApplicants(1)[0], appliedAt: '2026-10-01T09:00:00.000Z' }
  const interview = applyStageTransition(original, 'INTERVIEW', '2026-10-02T09:00:00.000Z')
  const offer = applyStageTransition(interview, 'OFFER', '2026-10-05T09:00:00.000Z')
  const hired = applyStageTransition(offer, 'HIRED', '2026-10-07T09:00:00.000Z')
  const corrected = applyStageTransition(hired, 'OFFER', '2026-10-08T09:00:00.000Z', { correction: true })
  const insight = getRecruitmentInsights([corrected])
  expect(insight.dwellDays.find((row) => row.stage === 'INTERVIEW')?.days).toBe(3)
  expect(insight.hiringDays).toEqual([6])
  expect(insight.transitions).toHaveLength(3)
  expect(insight.correctionCount).toBe(1)
})
