import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { loadApplicants, saveApplicants, STORAGE_KEY } from './mockDb'
import {
  DEFAULT_FAILURE_RATE,
  MAX_DELAY_MS,
  MIN_DELAY_MS,
  getMockDelay,
  resetMockApiTestConfig,
  setMockApiTestConfig,
} from './mockConfig'

const applicantsUrl = 'http://localhost/api/applicants'
const positionsUrl = 'http://localhost/api/positions'

beforeEach(() => {
  localStorage.clear()
  resetMockApiTestConfig()
})

afterEach(() => {
  resetMockApiTestConfig()
})

describe('mock applicants API', () => {
  test('returns 240 seeded applicants', async () => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })

    const response = await fetch(applicantsUrl)

    expect(response.status).toBe(200)
    expect(await response.json()).toHaveLength(240)
  })

  test('returns 503 when GET failure is forced', async () => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 1 })

    const response = await fetch(applicantsUrl)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ code: 'MOCK_FAILURE' })
  })

  test('returns seeded positions', async () => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })

    const response = await fetch(positionsUrl)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toHaveLength(6)
  })

  test('persists a successful PATCH', async () => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })

    const response = await fetch(`${applicantsUrl}/applicant-001/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'INTERVIEW' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ id: 'applicant-001', stage: 'INTERVIEW' })
    expect(loadApplicants().find(({ id }) => id === 'applicant-001')).toMatchObject({ stage: 'INTERVIEW' })
  })

  test('requires a reason for rejection and keeps the rejection details in the applicant history', async () => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
    const missingReason = await fetch(`${applicantsUrl}/applicant-001/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'REJECTED' }),
    })
    expect(missingReason.status).toBe(400)

    const response = await fetch(`${applicantsUrl}/applicant-001/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'REJECTED', transitionAt: '2026-09-08', rejectionReason: '경력 요건 불일치', rejectionMemo: '추후 재지원 가능' }),
    })
    expect(response.status).toBe(200)
    const updated = await response.json()
    expect(updated).toMatchObject({ stage: 'REJECTED', rejectionReason: '경력 요건 불일치', rejectionMemo: '추후 재지원 가능', timeline: expect.arrayContaining([expect.objectContaining({ at: '2026-09-08', label: '서류검토 → 불합격' })]) })
    expect(updated).not.toHaveProperty('nextAction')
  })

  test('allows explicit detail-only correction without changing the ordinary one-way policy', async () => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
    await fetch(applicantsUrl)
    const response = await fetch(`${applicantsUrl}/applicant-001/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'OFFER', correction: true, transitionAt: '2026-09-08' }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ stage: 'OFFER', timeline: expect.arrayContaining([expect.objectContaining({ label: '서류검토 → 처우협의 (단계 정정)' })]) })
  })

  test('does not change storage when PATCH failure is forced', async () => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
    await fetch(applicantsUrl)
    const before = localStorage.getItem('recruitment-pipeline-board:applicants:v1')
    setMockApiTestConfig({ delayMs: 0, failureRate: 1 })

    const response = await fetch(`${applicantsUrl}/applicant-001/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'INTERVIEW' }),
    })

    expect(response.status).toBe(503)
    expect(localStorage.getItem('recruitment-pipeline-board:applicants:v1')).toBe(before)
  })

  test('does not initialize storage when the first PATCH fails', async () => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 1 })

    const response = await fetch(`${applicantsUrl}/applicant-001/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'INTERVIEW' }),
    })

    expect(response.status).toBe(503)
    expect(localStorage.getItem('recruitment-pipeline-board:applicants:v1')).toBeNull()
  })

  test.each([
    ['missing body', undefined, 'INVALID_BODY'],
    ['malformed JSON', '{', 'INVALID_BODY'],
    ['array body', '[]', 'INVALID_BODY'],
    ['null body', 'null', 'INVALID_BODY'],
    ['primitive body', '"HIRED"', 'INVALID_BODY'],
    ['non-string stage', '{"stage":3}', 'INVALID_STAGE'],
    ['unknown stage', '{"stage":"UNKNOWN"}', 'INVALID_STAGE'],
  ])('rejects %s without changing storage', async (_name, body, code) => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
    await fetch(applicantsUrl)
    const before = localStorage.getItem('recruitment-pipeline-board:applicants:v1')

    const response = await fetch(`${applicantsUrl}/applicant-001/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code })
    expect(localStorage.getItem('recruitment-pipeline-board:applicants:v1')).toBe(before)
  })

  test('rejects an unknown applicant without changing storage', async () => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
    await fetch(applicantsUrl)
    const before = localStorage.getItem('recruitment-pipeline-board:applicants:v1')

    const response = await fetch(`${applicantsUrl}/missing/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'HIRED' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ code: 'NOT_FOUND' })
    expect(localStorage.getItem('recruitment-pipeline-board:applicants:v1')).toBe(before)
  })

  test('submits the current-stage evaluation and persists it', async () => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
    const applicant = loadApplicants()[0]!
    const evaluation = applicant.evaluations!.find(({ type }) => type === 'SCREEN')!

    const response = await fetch(`${applicantsUrl}/${applicant.id}/evaluations/${evaluation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer: '이서준', score: 88, comment: ' 진행 근거가 충분합니다. ' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      id: applicant.id,
      evaluations: expect.arrayContaining([expect.objectContaining({
        id: evaluation.id,
        status: 'SUBMITTED',
        reviewer: '이서준',
        score: 88,
        comment: '진행 근거가 충분합니다.',
        submittedAt: expect.any(String),
      })]),
      timeline: expect.arrayContaining([expect.objectContaining({ label: '서류검토 피드백 작성' })]),
    })
    expect(loadApplicants()[0]?.evaluations?.find(({ id }) => id === evaluation.id)).toMatchObject({
      status: 'SUBMITTED',
      comment: '진행 근거가 충분합니다.',
    })
  })

  test.each([
    ['empty comment', { reviewer: '김하나', score: 80, comment: '   ' }],
    ['low score', { reviewer: '김하나', score: -1, comment: '근거' }],
    ['high score', { reviewer: '김하나', score: 101, comment: '근거' }],
    ['unknown reviewer', { reviewer: '없는 담당자', score: 80, comment: '근거' }],
  ])('rejects feedback with %s without changing storage', async (_name, body) => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
    const applicant = loadApplicants()[0]!
    const evaluation = applicant.evaluations![0]!
    const before = localStorage.getItem(STORAGE_KEY)

    const response = await fetch(`${applicantsUrl}/${applicant.id}/evaluations/${evaluation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_BODY' })
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  })

  test('rejects malformed feedback JSON without changing storage', async () => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
    const applicant = loadApplicants()[0]!
    const evaluation = applicant.evaluations![0]!
    const before = localStorage.getItem(STORAGE_KEY)

    const response = await fetch(`${applicantsUrl}/${applicant.id}/evaluations/${evaluation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_BODY' })
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  })

  test('rejects an evaluation from a different stage without changing storage', async () => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
    const applicants = loadApplicants()
    const applicant = applicants[0]!
    const otherEvaluation = {
      ...applicant.evaluations![0]!,
      id: 'interview-evaluation',
      type: 'INTERVIEW' as const,
    }
    saveApplicants(applicants.map((current) => current.id === applicant.id
      ? { ...current, evaluations: [...current.evaluations!, otherEvaluation] }
      : current))
    const before = localStorage.getItem(STORAGE_KEY)

    const response = await fetch(`${applicantsUrl}/${applicant.id}/evaluations/${otherEvaluation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer: '김하나', score: 80, comment: '근거' }),
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_EVALUATION' })
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  })

  test('rejects overwriting submitted feedback without changing storage', async () => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
    const applicants = loadApplicants()
    const applicant = applicants[0]!
    const evaluation = {
      ...applicant.evaluations![0]!,
      status: 'SUBMITTED' as const,
      score: 80,
      comment: '기존 피드백',
      submittedAt: '2026-09-07',
    }
    saveApplicants(applicants.map((current) => current.id === applicant.id
      ? { ...current, evaluations: [evaluation] }
      : current))
    const before = localStorage.getItem(STORAGE_KEY)

    const response = await fetch(`${applicantsUrl}/${applicant.id}/evaluations/${evaluation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer: '이서준', score: 90, comment: '덮어쓰기 시도' }),
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_EVALUATION' })
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  })

  test.each([
    ['applicant', `${applicantsUrl}/missing/evaluations/evaluation-1`],
    ['evaluation', `${applicantsUrl}/applicant-001/evaluations/missing`],
  ])('rejects a missing feedback %s without changing storage', async (_name, url) => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
    loadApplicants()
    const before = localStorage.getItem(STORAGE_KEY)

    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer: '김하나', score: 80, comment: '근거' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ code: 'NOT_FOUND' })
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  })

  test('does not persist feedback when the mock failure is forced', async () => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
    const applicant = loadApplicants()[0]!
    const evaluation = applicant.evaluations![0]!
    const before = localStorage.getItem(STORAGE_KEY)
    setMockApiTestConfig({ delayMs: 0, failureRate: 1 })

    const response = await fetch(`${applicantsUrl}/${applicant.id}/evaluations/${evaluation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer: '김하나', score: 80, comment: '근거' }),
    })

    expect(response.status).toBe(503)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  })

  test.each([
    ['DOCUMENT_REVIEW', 'OFFER'],
    ['INTERVIEW', 'DOCUMENT_REVIEW'],
    ['HIRED', 'REJECTED'],
    ['REJECTED', 'INTERVIEW'],
  ] as const)('rejects the forbidden %s → %s transition without changing storage', async (currentStage, targetStage) => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
    const applicants = loadApplicants()
    localStorage.setItem(
      'recruitment-pipeline-board:applicants:v1',
      JSON.stringify([{ ...applicants[0], stage: currentStage }]),
    )
    const before = localStorage.getItem('recruitment-pipeline-board:applicants:v1')

    const response = await fetch(`${applicantsUrl}/applicant-001/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: targetStage }),
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_TRANSITION' })
    expect(localStorage.getItem('recruitment-pipeline-board:applicants:v1')).toBe(before)
  })

  test('uses the documented delay range and default failure rate', () => {
    expect(getMockDelay(() => 0)).toBe(MIN_DELAY_MS)
    expect(getMockDelay(() => 0.999999)).toBe(MAX_DELAY_MS)
    expect(DEFAULT_FAILURE_RATE).toBe(0.15)
  })

  test('keeps two successful PATCH changes after a later GET', async () => {
    setMockApiTestConfig({ delayMs: 0, failureRate: 0 })

    await Promise.all([
      fetch(`${applicantsUrl}/applicant-001/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'INTERVIEW' }),
      }),
      fetch(`${applicantsUrl}/applicant-002/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'REJECTED', rejectionReason: '직무 요건 불일치' }),
      }),
    ])

    const response = await fetch(applicantsUrl)
    const applicants = await response.json()

    expect(applicants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'applicant-001', stage: 'INTERVIEW' }),
        expect.objectContaining({ id: 'applicant-002', stage: 'REJECTED' }),
      ]),
    )
  })
})
