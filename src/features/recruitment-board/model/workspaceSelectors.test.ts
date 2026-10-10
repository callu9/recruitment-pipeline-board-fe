import { expect, test } from 'vitest'
import { createSeedApplicants, SEED_POSITIONS } from '../../../mocks/seedApplicants'
import {
  filterWorkspaceApplicants,
  paginateApplicants,
  sortWorkspaceApplicants,
  getCalendarEvents,
  getPositionSummaries,
  getStageCounts,
  getTodayActionableApplicants,
  getTodayInterviews,
  getUnscheduledApplicants,
  getWorkspaceWeekDays,
  getWorkspaceHeaderLabel,
  getLocalDateString,
} from './workspaceSelectors'

test('builds the local workspace week through Sunday without UTC date drift', () => {
  expect(getWorkspaceWeekDays('2026-09-07')).toEqual([
    '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13',
  ])
})

test('filters workspace rows by owner, stage, schedule, and overdue status', () => {
  const applicants = createSeedApplicants(30, '2026-09-07')
  applicants.push({ ...applicants[0], id: 'reschedule-filter', stage: 'INTERVIEW', schedule: null })
  const filtered = filterWorkspaceApplicants(applicants, {
    name: '', role: 'ALL', owner: '김하나', stage: 'INTERVIEW', noSchedule: true, overdue: true, positionId: '',
  }, '2026-09-07')

  expect(filtered.map(({ id }) => id)).toEqual(['reschedule-filter'])
})

test('derives stage counts and today/unscheduled queues from applicant data', () => {
  const applicants = createSeedApplicants(30, '2026-09-07')
  const counts = getStageCounts(applicants)

  expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(applicants.length)
  expect(getTodayInterviews(applicants, '2026-09-07').every((applicant) => applicant.schedule?.date === '2026-09-07')).toBe(true)
  expect(getUnscheduledApplicants(applicants).every((applicant) => applicant.stage === 'INTERVIEW' && !applicant.schedule)).toBe(true)
})

test('uses the local current date by default while accepting a deterministic date in transforms', () => {
  expect(getLocalDateString(new Date(2026, 8, 8))).toBe('2026-09-08')
  expect(getWorkspaceHeaderLabel('2026-09-08')).toBe('TUE · SEP 08, 2026')
  expect(getWorkspaceWeekDays('2026-12-28')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'])
})

test('removes terminal applicants from Today and future calendar events but preserves their history', () => {
  const applicant = { ...createSeedApplicants(1)[0], stage: 'HIRED' as const, schedule: { ...createSeedApplicants(1)[0].schedule!, date: '2026-09-09' }, timeline: [{ id: 'history', at: '2026-09-01', label: '면접 → 최종합격' }] }
  expect(getTodayInterviews([applicant], '2026-09-09')).toEqual([])
  expect(getCalendarEvents([applicant])).toEqual([])
  expect(applicant.timeline).toHaveLength(1)
})

test('counts each actionable applicant once across Today queues', () => {
  const source = createSeedApplicants(2)[1]!
  const applicant = { ...source, stage: 'INTERVIEW' as const, schedule: { ...source.schedule!, date: '2026-09-07' }, dueDate: '2026-09-07' }

  expect(getTodayActionableApplicants([applicant], '2026-09-07')).toEqual([applicant])
})

test('creates typed calendar events and position counts without mutating source data', () => {
  const applicants = createSeedApplicants(30, '2026-09-07')
  const events = getCalendarEvents(applicants)
  const summaries = getPositionSummaries(SEED_POSITIONS, applicants)

  expect(new Set(events.map((event) => event.type))).toEqual(new Set(['INTERVIEW', 'EVALUATION', 'OFFER']))
  expect(summaries.every((position) => position.applicantCount >= position.hiredCount)).toBe(true)
  expect(applicants[0]?.stage).toBe('DOCUMENT_REVIEW')
})


test.each([0, 1, 20, 21, 240])('paginates %i applicants with valid ranges and no source changes', (size) => {
  const applicants = createSeedApplicants(size)
  const original = structuredClone(applicants)
  const result = paginateApplicants(applicants, 1, 20)
  expect(result).toEqual({ items: applicants.slice(0, 20), page: 1, totalPages: Math.ceil(size / 20), total: size, from: size ? 1 : 0, to: Math.min(20, size) })
  expect(applicants).toEqual(original)
  result.items.forEach((item, index) => expect(item).toBe(applicants[index]))
})

test.each([20, 50, 100] as const)('visits every ID once with page size %i and clamps page bounds', (pageSize) => {
  const applicants = createSeedApplicants(240)
  const totalPages = Math.ceil(applicants.length / pageSize)
  const visited = Array.from({ length: totalPages }, (_, index) => paginateApplicants(applicants, index + 1, pageSize).items).flat()
  expect(visited.map(({ id }) => id)).toEqual(applicants.map(({ id }) => id))
  expect(new Set(visited.map(({ id }) => id)).size).toBe(240)
  expect(paginateApplicants(applicants, -2, pageSize).page).toBe(1)
  const last = paginateApplicants(applicants, 999, pageSize)
  expect(last.page).toBe(totalPages)
  expect(last.to).toBe(240)
  expect(last.from).toBe((totalPages - 1) * pageSize + 1)
  expect(last.items).toHaveLength(pageSize === 20 ? 20 : 40)
  expect(paginateApplicants([], 999, pageSize)).toEqual({ items: [], page: 1, totalPages: 0, total: 0, from: 0, to: 0 })
})

const sortIds = (items: ReturnType<typeof createSeedApplicants>, sort: 'APPLIED' | 'DUE' | 'OVERDUE') => sortWorkspaceApplicants(items, sort, '2026-10-07').map(({ id }) => id)

test('sorts latest applications with deterministic ID ties without mutating source', () => {
  const items = createSeedApplicants(3).map((item, i) => ({ ...item, id: ['b', 'a', 'c'][i], appliedAt: ['2026-10-01', '2026-10-01', '2026-10-03'][i] }))
  const before = structuredClone(items)
  expect(sortIds(items, 'APPLIED')).toEqual(['c', 'a', 'b'])
  expect(items).toEqual(before)
  expect(sortWorkspaceApplicants([], 'APPLIED')).toEqual([])
})

test('sorts active deadlines first, then no date and terminal applicants by application and ID', () => {
  const items = createSeedApplicants(5).map((item, i) => ({ ...item, id: String(i), evaluations: [], stage: i === 3 ? 'HIRED' as const : 'DOCUMENT_REVIEW' as const, appliedAt: ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-03'][i], dueDate: ['2026-10-09', '2026-10-08', undefined, '2026-10-01', '2026-10-08'][i] }))
  expect(sortIds(items, 'DUE')).toEqual(['1', '4', '0', '3', '2'])
})

test('overdue priority excludes today, missing dates and terminal stages', () => {
  const items = createSeedApplicants(5).map((item, i) => ({ ...item, id: String(i), evaluations: [], stage: i === 3 ? 'REJECTED' as const : 'INTERVIEW' as const, appliedAt: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'][i], dueDate: ['2026-10-06', '2026-10-01', '2026-10-07', '2026-10-01', undefined][i] }))
  expect(sortIds(items, 'OVERDUE')).toEqual(['1', '0', '4', '3', '2'])
})

test('formats deadline urgency by calendar days across DST and year boundaries', async () => {
  const workspace = await import('./workspaceSelectors')
  expect(workspace.formatWorkspaceDueDate).toBeTypeOf('function')
  expect(workspace.formatWorkspaceDueDate('2026-03-09', true, '2026-03-08')).toBe('2026.03.09 · 내일 마감')
  expect(workspace.formatWorkspaceDueDate('2026-11-01', true, '2026-11-03')).toBe('2026.11.01 · 2일 지연')
  expect(workspace.formatWorkspaceDueDate('2027-01-01', true, '2026-12-31')).toBe('2027.01.01 · 내일 마감')
  expect(workspace.formatWorkspaceDueDate('2026-10-08', true, '2026-10-08')).toBe('2026.10.08 · 오늘 마감')
  expect(workspace.formatWorkspaceDueDate('2026-10-08', false, '2026-10-10')).toBe('2026.10.08')
  expect(workspace.formatWorkspaceDueDate(undefined, true, '2026-10-08')).toBe('미정')
})
