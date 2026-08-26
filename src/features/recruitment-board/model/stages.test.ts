import { expect, test } from 'vitest'
import { canTransitionTo, getAllowedNextStages } from './stages'

test.each([
  ['DOCUMENT_REVIEW', ['INTERVIEW', 'REJECTED']],
  ['INTERVIEW', ['OFFER', 'REJECTED']],
  ['OFFER', ['HIRED', 'REJECTED']],
  ['HIRED', []],
  ['REJECTED', []],
] as const)('allows only the next stages from %s', (currentStage, expectedStages) => {
  expect(getAllowedNextStages(currentStage)).toEqual(expectedStages)
})

test('rejects skipped, previous, and terminal-stage moves', () => {
  expect(canTransitionTo('DOCUMENT_REVIEW', 'OFFER')).toBe(false)
  expect(canTransitionTo('INTERVIEW', 'DOCUMENT_REVIEW')).toBe(false)
  expect(canTransitionTo('HIRED', 'REJECTED')).toBe(false)
  expect(canTransitionTo('REJECTED', 'INTERVIEW')).toBe(false)
})
