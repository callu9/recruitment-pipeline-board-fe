import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ApplicantOperations } from './ApplicantOperations'
import { createSeedApplicants, SEED_POSITIONS } from './mocks/seedApplicants'

test('G17 R2: assignment form does not carry a completed answer to another position', () => {
  const applicant = { ...createSeedApplicants(1, '2026-10-07')[0]!, stage: 'DOCUMENT_REVIEW' as const }
  const other = SEED_POSITIONS.find(({ id }) => id !== applicant.positionId)!
  const positions = SEED_POSITIONS.map((position) => position.id === applicant.positionId ? { ...position, assignment: '과제 A' } : position.id === other.id ? { ...position, assignment: '과제 B' } : position)
  const done = { ...applicant, followUps: [{ id: `assignment-${applicant.id}-${applicant.positionId}`, label: '과제 제출 확인 · 과제 A', dueDate: '2026-10-12', done: true }] }
  const props = { actor: '김하나' as const, pending: false, save: async () => null, positions }
  const { rerender } = render(<ApplicantOperations {...props} applicant={done} />)
  expect(within(screen.getByRole('form', { name: '과제 관리' })).getByLabelText<HTMLSelectElement>('제출 여부').value).toBe('true')
  rerender(<ApplicantOperations {...props} applicant={{ ...done, positionId: other.id }} />)
  const form = screen.getByRole('form', { name: '과제 관리' })
  expect(within(form).getByText(/과제 B · 제출 미확인/)).toBeTruthy()
  expect(within(form).getByLabelText<HTMLSelectElement>('제출 여부').value).toBe('false')
})
test('G17 R4: the general follow-up form does not offer assignment checks', () => {
  const applicant = { ...createSeedApplicants(1, '2026-10-07')[0]!, stage: 'DOCUMENT_REVIEW' as const }
  const positions = SEED_POSITIONS.map((position) => position.id === applicant.positionId ? { ...position, assignment: '과제 A' } : position)
  const followUps = [{ id: `assignment-${applicant.id}-${applicant.positionId}`, label: '과제 제출 확인 · 과제 A', dueDate: '2026-10-12', done: false }, { id: 'task-1', label: '서류 보완 요청', dueDate: '2026-10-12', done: false }]
  render(<ApplicantOperations actor="김하나" pending={false} save={async () => null} positions={positions} applicant={{ ...applicant, followUps }} />)
  const options = within(within(screen.getByRole('form', { name: '후속 업무 관리' })).getByLabelText('편집할 업무')).getAllByRole('option').map(({ textContent }) => textContent)
  expect(options).toEqual(['새 업무', '서류 보완 요청 · 대기'])
})
test('G17 R9: the first focusable control of the assignment form is the due date', () => {
  const applicant = { ...createSeedApplicants(1, '2026-10-07')[0]!, stage: 'DOCUMENT_REVIEW' as const }
  const positions = SEED_POSITIONS.map((position) => position.id === applicant.positionId ? { ...position, assignment: '과제 A' } : position)
  render(<ApplicantOperations actor="김하나" pending={false} save={async () => null} positions={positions} applicant={applicant} />)
  const section = screen.getByRole('form', { name: '과제 관리' }).closest('[data-operation-title]')!
  expect(section.querySelector('input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled)')).toBe(screen.getByLabelText('과제 제출 기한'))
})
