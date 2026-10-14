import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { RecruitmentManagement } from './RecruitmentManagement'
import { positionsQueryKey } from './features/recruitment-board/api/usePositionsQuery'
import { resetMockApiTestConfig, setMockApiTestConfig } from './mocks/mockConfig'
import { SEED_POSITIONS } from './mocks/seedApplicants'

afterEach(() => resetMockApiTestConfig())
test('PR review P2: creating a position before the list loaded does not cache a partial list', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  const client = new QueryClient()
  render(<QueryClientProvider client={client}><RecruitmentManagement positions={[]} applicants={[]} actor="김하나" mode="positions" /></QueryClientProvider>)
  const form = screen.getByRole('form', { name: '포지션 개설·수정' })
  fireEvent.change(within(form).getByLabelText('포지션명'), { target: { value: '새 포지션' } })
  fireEvent.change(within(form).getByLabelText('부서'), { target: { value: '플랫폼' } })
  fireEvent.submit(form)
  await waitFor(() => expect(within(form).getByRole('status')).toHaveTextContent('저장했습니다'))
  expect(client.getQueryData(positionsQueryKey)).toBeUndefined()
})
test('PR review R3: a restored edit target waits for the position list before saving', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  sessionStorage.setItem('recruitment-operation-draft:position:포지션 개설·수정', JSON.stringify({ id: SEED_POSITIONS[0]!.id, title: '수정 중' }))
  const client = new QueryClient()
  const view = (positions: typeof SEED_POSITIONS) => <QueryClientProvider client={client}><RecruitmentManagement positions={positions} applicants={[]} actor="김하나" mode="positions" /></QueryClientProvider>
  const { rerender } = render(view([]))
  const form = screen.getByRole('form', { name: '포지션 개설·수정' })
  fireEvent.submit(form)
  expect(await within(form).findByRole('alert')).toHaveTextContent('편집할 대상을 불러온 뒤 저장해 주세요.')
  rerender(view(SEED_POSITIONS))
  await waitFor(() => expect(within(form).getByLabelText('편집할 포지션')).toHaveValue(SEED_POSITIONS[0]!.id))
  sessionStorage.clear()
})
