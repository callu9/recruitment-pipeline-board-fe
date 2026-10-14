import type React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ApplicantOperations } from './ApplicantOperations'
import { createSeedApplicants, SEED_POSITIONS } from './mocks/seedApplicants'
import { contactVersion } from './features/recruitment-board/model/operations'

test('G17 R2: assignment form does not carry a completed answer to another position', () => {
  const applicant = { ...createSeedApplicants(1, '2026-10-07')[0]!, stage: 'DOCUMENT_REVIEW' as const }
  const other = SEED_POSITIONS.find(({ id }) => id !== applicant.positionId)!
  const positions = SEED_POSITIONS.map((position) => position.id === applicant.positionId ? { ...position, assignment: '과제 A' } : position.id === other.id ? { ...position, assignment: '과제 B' } : position)
  const done = { ...applicant, followUps: [{ id: `assignment-${applicant.id}-${applicant.positionId}`, label: '과제 제출 확인 · 과제 A', dueDate: '2026-10-12', done: true }] }
  const props = { actor: '김하나' as const, pending: false, save: async () => null, positions }
  const wrap = (node: React.ReactNode) => <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>
  const { rerender } = render(wrap(<ApplicantOperations {...props} applicant={done} />))
  expect(within(screen.getByRole('form', { name: '과제 관리' })).getByLabelText<HTMLSelectElement>('제출 여부').value).toBe('true')
  rerender(wrap(<ApplicantOperations {...props} applicant={{ ...done, positionId: other.id }} />))
  const form = screen.getByRole('form', { name: '과제 관리' })
  expect(within(form).getByText(/과제 B · 제출 미확인/)).toBeTruthy()
  expect(within(form).getByLabelText<HTMLSelectElement>('제출 여부').value).toBe('false')
})
test('G17 R4: the general follow-up form does not offer assignment checks', () => {
  const applicant = { ...createSeedApplicants(1, '2026-10-07')[0]!, stage: 'DOCUMENT_REVIEW' as const }
  const positions = SEED_POSITIONS.map((position) => position.id === applicant.positionId ? { ...position, assignment: '과제 A' } : position)
  const followUps = [{ id: `assignment-${applicant.id}-${applicant.positionId}`, label: '과제 제출 확인 · 과제 A', dueDate: '2026-10-12', done: false }, { id: 'task-1', label: '서류 보완 요청', dueDate: '2026-10-12', done: false }]
  render(<QueryClientProvider client={new QueryClient()}><ApplicantOperations actor="김하나" pending={false} save={async () => null} positions={positions} applicant={{ ...applicant, followUps }} /></QueryClientProvider>)
  const options = within(within(screen.getByRole('form', { name: '후속 업무 관리' })).getByLabelText('편집할 업무')).getAllByRole('option').map(({ textContent }) => textContent)
  expect(options).toEqual(['새 업무', '서류 보완 요청 · 대기'])
})
test('G17 R9: the first focusable control of the assignment form is the due date', () => {
  const applicant = { ...createSeedApplicants(1, '2026-10-07')[0]!, stage: 'DOCUMENT_REVIEW' as const }
  const positions = SEED_POSITIONS.map((position) => position.id === applicant.positionId ? { ...position, assignment: '과제 A' } : position)
  render(<QueryClientProvider client={new QueryClient()}><ApplicantOperations actor="김하나" pending={false} save={async () => null} positions={positions} applicant={applicant} /></QueryClientProvider>)
  const section = screen.getByRole('form', { name: '과제 관리' }).closest('[data-operation-title]')!
  expect(section.querySelector('input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled)')).toBe(screen.getByLabelText('과제 제출 기한'))
})
test('Form sync P3: a restored contact-linked task keeps its date read-only', () => {
  const applicant = createSeedApplicants(1, '2026-10-07')[0]!
  const contact = { id: `contact-${applicant.id}-1`, channel: '전화', content: '안내', date: '2026-10-10', status: 'PLANNED' as const, reply: '', actor: '김하나' as const }
  sessionStorage.setItem(`recruitment-operation-draft:${applicant.id}:후속 업무 관리`, JSON.stringify({ id: contact.id }))
  render(<QueryClientProvider client={new QueryClient()}><ApplicantOperations actor="김하나" pending={false} save={async () => null} positions={SEED_POSITIONS} applicant={{ ...applicant, contacts: [contact], followUps: [{ id: contact.id, label: '연락 예정: 안내', dueDate: '2026-10-10', done: false }] }} /></QueryClientProvider>)
  const form = screen.getByRole('form', { name: '후속 업무 관리' })
  expect(within(form).getByLabelText('편집할 업무')).toHaveValue(contact.id)
  expect(within(form).getByLabelText<HTMLInputElement>('후속 업무 기한').readOnly).toBe(true)
  expect(within(form).getByLabelText('후속 업무')).toHaveValue('연락 예정: 안내')
  sessionStorage.clear()
})
test('Form sync R3: a draft pointing at a task that no longer exists returns to a new task', async () => {
  const applicant = createSeedApplicants(1, '2026-10-07')[0]!
  sessionStorage.setItem(`recruitment-operation-draft:${applicant.id}:후속 업무 관리`, JSON.stringify({ id: 'contact-gone-1' }))
  const saves: unknown[] = []
  render(<QueryClientProvider client={new QueryClient()}><ApplicantOperations actor="김하나" pending={false} save={async (operation) => { saves.push(operation); return null }} positions={SEED_POSITIONS} applicant={{ ...applicant, followUps: [] }} /></QueryClientProvider>)
  const form = screen.getByRole('form', { name: '후속 업무 관리' })
  fireEvent.change(within(form).getByLabelText('후속 업무'), { target: { value: '서류 보완 요청' } })
  fireEvent.change(within(form).getByLabelText('후속 업무 기한'), { target: { value: '2026-10-21' } })
  fireEvent.submit(form)
  await waitFor(() => expect(saves).toEqual([{ kind: 'task', id: undefined, label: '서류 보완 요청', dueDate: '2026-10-21', done: false }]))
  sessionStorage.clear()
})
test('Form sync R4: an open form whose record is removed elsewhere returns to a new record', () => {
  const applicant = createSeedApplicants(1, '2026-10-07')[0]!
  const contact = { id: `contact-${applicant.id}-1`, channel: '전화', content: '안내', date: '2026-10-10', status: 'PLANNED' as const, reply: '', actor: '김하나' as const }
  const props = { actor: '김하나' as const, pending: false, save: async () => null, positions: SEED_POSITIONS }
  const client = new QueryClient()
  const { rerender } = render(<QueryClientProvider client={client}><ApplicantOperations {...props} applicant={{ ...applicant, contacts: [contact], followUps: [{ id: contact.id, label: '연락 예정: 안내', dueDate: '2026-10-10', done: false }] }} /></QueryClientProvider>)
  const form = screen.getByRole('form', { name: '후속 업무 관리' })
  fireEvent.change(within(form).getByLabelText('편집할 업무'), { target: { value: contact.id } })
  expect(within(form).getByLabelText('후속 업무')).toHaveValue('연락 예정: 안내')
  rerender(<QueryClientProvider client={client}><ApplicantOperations {...props} applicant={{ ...applicant, contacts: [{ ...contact, status: 'DONE' }], followUps: [] }} /></QueryClientProvider>)
  expect(within(form).getByLabelText('편집할 업무')).toHaveValue('')
  expect(within(form).getByLabelText('후속 업무')).toHaveValue('')
  expect(within(form).getByLabelText<HTMLInputElement>('후속 업무 기한').readOnly).toBe(false)
})
test('Form sync R5: single-record forms follow stored changes but keep fields the user is editing', () => {
  const applicant = { ...createSeedApplicants(1, '2026-10-07')[0]!, dueDate: '2026-10-30', nextAction: '서류 보완', offer: { conditions: '연봉', proposedAt: '2026-10-10', responseDueDate: '2026-10-12', status: 'SENT' as const, reason: '', active: true } }
  const props = { actor: '김하나' as const, pending: false, save: async () => null, positions: SEED_POSITIONS }
  const client = new QueryClient()
  const { rerender } = render(<QueryClientProvider client={client}><ApplicantOperations {...props} applicant={applicant} /></QueryClientProvider>)
  const work = screen.getByRole('form', { name: '담당 업무 편집' })
  const offer = screen.getByRole('form', { name: '오퍼 관리' })
  fireEvent.change(within(offer).getByLabelText('오퍼 조건'), { target: { value: '연봉 조정 중' } })
  rerender(<QueryClientProvider client={client}><ApplicantOperations {...props} applicant={{ ...applicant, dueDate: undefined, nextAction: '인터뷰 일정 등록', offer: { ...applicant.offer, conditions: '다른 조건', status: 'ACCEPTED' as const } }} /></QueryClientProvider>)
  expect(within(work).getByLabelText('업무 기한')).toHaveValue('')
  expect(within(work).getByLabelText('다음 행동')).toHaveValue('인터뷰 일정 등록')
  expect(within(offer).getByLabelText('오퍼 조건')).toHaveValue('연봉 조정 중')
  expect(within(offer).getByLabelText('오퍼 상태')).toHaveValue('ACCEPTED')
})
test('Form sync R6: the evaluation plan form starts from the selected evaluation', () => {
  const applicant = createSeedApplicants(1, '2026-10-07')[0]!
  const evaluation = { ...applicant.evaluations![0]!, reviewer: '이서준' as const, dueDate: '2026-10-25' }
  render(<QueryClientProvider client={new QueryClient()}><ApplicantOperations actor="김하나" pending={false} save={async () => null} positions={SEED_POSITIONS} applicant={{ ...applicant, evaluations: [evaluation] }} /></QueryClientProvider>)
  const form = screen.getByRole('form', { name: '평가 계획·재평가' })
  expect(within(form).getByLabelText('계획 평가자')).toHaveValue('이서준')
  expect(within(form).getByLabelText('평가 기한')).toHaveValue('2026-10-25')
})
test('Form sync R7: selection forms follow changes to the selected record except fields being edited and the conflict baseline', () => {
  const applicant = createSeedApplicants(1, '2026-10-07')[0]!
  const evaluation = { ...applicant.evaluations![0]!, reviewer: '이서준' as const, dueDate: '2026-10-20' }
  const contact = { id: `contact-${applicant.id}-1`, channel: '전화', content: '안내', date: '2026-10-20', status: 'PLANNED' as const, reply: '', actor: '김하나' as const }
  const task = { id: contact.id, label: '연락 예정: 안내', dueDate: '2026-10-20', done: false }
  const props = { actor: '김하나' as const, pending: false, save: async () => null, positions: SEED_POSITIONS }
  const client = new QueryClient()
  const view = (data: typeof applicant) => <QueryClientProvider client={client}><ApplicantOperations {...props} applicant={data} /></QueryClientProvider>
  const { rerender } = render(view({ ...applicant, evaluations: [evaluation], contacts: [contact], followUps: [task] }))
  const plan = screen.getByRole('form', { name: '평가 계획·재평가' })
  const tasks = screen.getByRole('form', { name: '후속 업무 관리' })
  const contacts = screen.getByRole('form', { name: '연락 기록' })
  fireEvent.change(within(tasks).getByLabelText('편집할 업무'), { target: { value: task.id } })
  fireEvent.change(within(contacts).getByLabelText('편집할 연락'), { target: { value: contact.id } })
  const base = (contacts as HTMLFormElement).elements.namedItem('base') as HTMLInputElement
  const originalBase = base.value
  fireEvent.change(within(plan).getByLabelText('계획 평가자'), { target: { value: '박민지' } })
  fireEvent.change(within(contacts).getByLabelText('응답'), { target: { value: '회신 작성 중' } })
  rerender(view({ ...applicant, evaluations: [{ ...evaluation, dueDate: '2026-10-25' }], contacts: [{ ...contact, date: '2026-10-25' }], followUps: [{ ...task, dueDate: '2026-10-25' }] }))
  expect(within(plan).getByLabelText('평가 기한')).toHaveValue('2026-10-25')
  expect(within(plan).getByLabelText('계획 평가자')).toHaveValue('박민지')
  expect(within(tasks).getByLabelText('후속 업무 기한')).toHaveValue('2026-10-25')
  expect(within(contacts).getByLabelText('연락 날짜')).toHaveValue('2026-10-25')
  expect(within(contacts).getByLabelText('응답')).toHaveValue('회신 작성 중')
  expect(base.value).toBe(originalBase)
})
test('Form sync R7: a selected but unedited contact keeps its conflict baseline current', () => {
  const applicant = createSeedApplicants(1, '2026-10-07')[0]!
  const contact = { id: `contact-${applicant.id}-1`, channel: '전화', content: '안내', date: '2026-10-20', status: 'PLANNED' as const, reply: '', actor: '김하나' as const }
  const props = { actor: '김하나' as const, pending: false, save: async () => null, positions: SEED_POSITIONS }
  const client = new QueryClient()
  const view = (data: typeof applicant) => <QueryClientProvider client={client}><ApplicantOperations {...props} applicant={data} /></QueryClientProvider>
  const { rerender } = render(view({ ...applicant, contacts: [contact] }))
  const contacts = screen.getByRole('form', { name: '연락 기록' }) as HTMLFormElement
  fireEvent.change(within(contacts).getByLabelText('편집할 연락'), { target: { value: contact.id } })
  rerender(view({ ...applicant, contacts: [{ ...contact, status: 'DONE' }] }))
  expect((contacts.elements.namedItem('base') as HTMLInputElement).value).toBe(contactVersion({ ...contact, status: 'DONE' }))
  expect(within(contacts).getByLabelText('실행 여부')).toHaveValue('DONE')
})
test('Form sync R8: a restored contact draft keeps the baseline it was edited against', () => {
  const applicant = createSeedApplicants(1, '2026-10-07')[0]!
  const contact = { id: `contact-${applicant.id}-1`, channel: '전화', content: '안내', date: '2026-10-10', status: 'DONE' as const, reply: '확인', followUpDate: '2026-10-15', actor: '김하나' as const }
  const props = { actor: '김하나' as const, pending: false, save: async () => null, positions: SEED_POSITIONS }
  const client = new QueryClient()
  const first = render(<QueryClientProvider client={client}><ApplicantOperations {...props} applicant={{ ...applicant, contacts: [contact] }} /></QueryClientProvider>)
  let form = screen.getByRole('form', { name: '연락 기록' }) as HTMLFormElement
  fireEvent.change(within(form).getByLabelText('편집할 연락'), { target: { value: contact.id } })
  fireEvent.change(within(form).getByLabelText('재연락 기한'), { target: { value: '2026-10-18' } })
  first.unmount()
  render(<QueryClientProvider client={client}><ApplicantOperations {...props} applicant={{ ...applicant, contacts: [{ ...contact, followUpDate: '' }] }} /></QueryClientProvider>)
  form = screen.getByRole('form', { name: '연락 기록' }) as HTMLFormElement
  expect(within(form).getByLabelText('재연락 기한')).toHaveValue('2026-10-18')
  expect((form.elements.namedItem('base') as HTMLInputElement).value).toBe(contactVersion(contact))
  sessionStorage.clear()
})
