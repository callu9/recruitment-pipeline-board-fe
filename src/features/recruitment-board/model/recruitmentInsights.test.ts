import { expect, test } from 'vitest'
import { createSeedApplicants } from '../../../mocks/seedApplicants'
import { getRecruitmentInsights } from './recruitmentInsights'
import { applyStageTransition } from './stages'
import { applyApplicantOperation } from './operations'

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
test('G18: keeps every recorded exit reason across reactivation and measures actual start dates', () => {
  const base = { ...createSeedApplicants(1)[0]!, appliedAt: '2026-10-01T09:00:00.000Z' }
  const withdrawn = applyApplicantOperation(base, { kind: 'lifecycle', status: 'WITHDRAWN', reason: '타사 합류' }, '김하나', '2026-10-02T09:00:00.000Z')
  const resumed = applyApplicantOperation(withdrawn, { kind: 'lifecycle', status: 'ACTIVE', reason: '재개 요청' }, '김하나', '2026-10-03T09:00:00.000Z')
  const insight = getRecruitmentInsights([resumed, { ...base, id: 'legacy', lifecycle: 'WITHDRAWN', lifecycleReason: '기존 데이터 사유' }])
  expect(insight.reasons).toEqual(['타사 합류', '기존 데이터 사유'])
  const started = { ...base, id: 'started', employment: { plannedStartDate: '2026-10-20', actualStartDate: '2026-10-21', active: true } }
  const ended = { ...base, id: 'ended', employment: { plannedStartDate: '2026-10-20', actualStartDate: '', active: true } }
  const startInsight = getRecruitmentInsights([started, ended])
  expect(startInsight.startDays).toEqual([20])
})
test('G18 R1: keeps exit reasons logged before structured lifecycle fields after reactivation', () => {
  const base = { ...createSeedApplicants(1)[0]!, lifecycle: 'WITHDRAWN' as const, lifecycleReason: '타사 합류', timeline: [{ id: 'legacy-1', at: '2026-10-02T09:00:00.000Z', actor: '김하나' as const, label: '지원 상태 철회 · 타사 합류' }] }
  const resumed = applyApplicantOperation(base, { kind: 'lifecycle', status: 'ACTIVE', reason: '재개 요청' }, '김하나', '2026-10-03T09:00:00.000Z')
  expect(getRecruitmentInsights([resumed]).reasons).toEqual(['타사 합류'])
})
test('G18 R2: keeps an offer decline logged by the earlier offer form after reactivation', () => {
  const base = { ...createSeedApplicants(1)[0]!, lifecycle: 'OFFER_DECLINED' as const, lifecycleReason: '타사 합류', offer: { conditions: '연봉 · 복지', proposedAt: '2026-10-01', responseDueDate: '2026-10-05', status: 'DECLINED' as const, reason: '타사 합류', active: false, history: [] }, timeline: [{ id: 'legacy-1', at: '2026-10-02T09:00:00.000Z', actor: '김하나' as const, label: '오퍼 지원자 거절 · 연봉 · 복지 · 타사 합류' }] }
  const resumed = applyApplicantOperation(base, { kind: 'lifecycle', status: 'ACTIVE', reason: '재개 요청' }, '김하나', '2026-10-03T09:00:00.000Z')
  expect(getRecruitmentInsights([resumed]).reasons).toEqual(['타사 합류'])
})
test('G18 R3: matches earlier offer declines by the full label, not a shared suffix', () => {
  const declined = { conditions: '연봉', proposedAt: '2026-10-01', responseDueDate: '2026-10-05', status: 'DECLINED' as const, reason: '타사 합류' }
  const base = { ...createSeedApplicants(1)[0]!, offer: { ...declined, active: false, history: [{ ...declined, conditions: '연봉 2', reason: '복지 · 타사 합류' }] }, timeline: [{ id: 'legacy-1', at: '2026-10-02T09:00:00.000Z', label: '오퍼 지원자 거절 · 연봉 2 · 복지 · 타사 합류' }, { id: 'legacy-2', at: '2026-10-03T09:00:00.000Z', label: '오퍼 지원자 거절 · 연봉 · 타사 합류' }] }
  expect(getRecruitmentInsights([base]).reasons).toEqual(['복지 · 타사 합류', '타사 합류'])
})
test('G18 R4: matches an earlier offer decline whose label kept untrimmed conditions', () => {
  const base = { ...createSeedApplicants(1)[0]!, offer: { conditions: '연봉', proposedAt: '2026-10-01', responseDueDate: '2026-10-05', status: 'DECLINED' as const, reason: '타사 합류', active: false, history: [] }, timeline: [{ id: 'legacy-1', at: '2026-10-02T09:00:00.000Z', label: '오퍼 지원자 거절 ·  연봉  · 타사 합류' }] }
  expect(getRecruitmentInsights([base]).reasons).toEqual(['타사 합류'])
})
test('G18 R8: reports stored actual starts that precede the application instead of dropping them silently', () => {
  const base = { ...createSeedApplicants(1)[0]!, appliedAt: '2026-10-10T09:00:00.000Z', employment: { plannedStartDate: '2026-10-09', actualStartDate: '2026-10-09', active: true } }
  expect(getRecruitmentInsights([base])).toMatchObject({ startDays: [], invalidStarts: 1 })
})
