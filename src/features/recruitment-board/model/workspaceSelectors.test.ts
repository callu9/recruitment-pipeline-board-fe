import { expect, test } from 'vitest'
import { createSeedApplicants, SEED_POSITIONS } from '../../../mocks/seedApplicants'
import {
  filterWorkspaceApplicants,
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
  const filtered = filterWorkspaceApplicants(applicants, {
    name: '', role: 'ALL', owner: '김하나', stage: 'DOCUMENT_REVIEW', noSchedule: true, overdue: true, positionId: '',
  }, '2026-09-07')

  expect(filtered.every((applicant) => applicant.owner === '김하나' && applicant.stage === 'DOCUMENT_REVIEW' && !applicant.schedule && applicant.dueDate === '2026-09-05')).toBe(true)
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
