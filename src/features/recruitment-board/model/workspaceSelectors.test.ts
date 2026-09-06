import { expect, test } from 'vitest'
import { createSeedApplicants, SEED_POSITIONS } from '../../../mocks/seedApplicants'
import {
  filterWorkspaceApplicants,
  getCalendarEvents,
  getPositionSummaries,
  getStageCounts,
  getTodayInterviews,
  getUnscheduledApplicants,
  WORKSPACE_TODAY,
} from './workspaceSelectors'

test('filters workspace rows by owner, stage, schedule, and overdue status', () => {
  const applicants = createSeedApplicants(30)
  const filtered = filterWorkspaceApplicants(applicants, {
    name: '', role: 'ALL', owner: '김하나', stage: 'DOCUMENT_REVIEW', noSchedule: true, overdue: true, positionId: '',
  })

  expect(filtered.every((applicant) => applicant.owner === '김하나' && applicant.stage === 'DOCUMENT_REVIEW' && !applicant.schedule && applicant.dueDate === '2026-09-05')).toBe(true)
})

test('derives stage counts and today/unscheduled queues from applicant data', () => {
  const applicants = createSeedApplicants(30)
  const counts = getStageCounts(applicants)

  expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(applicants.length)
  expect(getTodayInterviews(applicants).every((applicant) => applicant.schedule?.date === WORKSPACE_TODAY)).toBe(true)
  expect(getUnscheduledApplicants(applicants).every((applicant) => applicant.stage === 'INTERVIEW' && !applicant.schedule)).toBe(true)
})

test('creates typed calendar events and position counts without mutating source data', () => {
  const applicants = createSeedApplicants(30)
  const events = getCalendarEvents(applicants)
  const summaries = getPositionSummaries(SEED_POSITIONS, applicants)

  expect(new Set(events.map((event) => event.type))).toEqual(new Set(['INTERVIEW', 'EVALUATION', 'OFFER', 'START_DATE']))
  expect(summaries.every((position) => position.applicantCount >= position.hiredCount)).toBe(true)
  expect(applicants[0]?.stage).toBe('DOCUMENT_REVIEW')
})
