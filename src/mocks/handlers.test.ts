import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { loadApplicants } from './mockDb'
import {
  DEFAULT_FAILURE_RATE,
  MAX_DELAY_MS,
  MIN_DELAY_MS,
  getMockDelay,
  resetMockApiTestConfig,
  setMockApiTestConfig,
} from './mockConfig'

const applicantsUrl = 'http://localhost/api/applicants'

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
        body: JSON.stringify({ stage: 'REJECTED' }),
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
