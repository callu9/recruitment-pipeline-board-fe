import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { RecruitmentManagement } from './RecruitmentManagement'
import { positionsQueryKey } from './features/recruitment-board/api/usePositionsQuery'
import { resetMockApiTestConfig, setMockApiTestConfig } from './mocks/mockConfig'

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
