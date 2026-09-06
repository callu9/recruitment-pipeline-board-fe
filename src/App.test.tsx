import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import App from './App'
import { resetMockApiTestConfig, setMockApiTestConfig } from './mocks/mockConfig'
import { createSeedApplicants, SEED_POSITIONS } from './mocks/seedApplicants'
import { server } from './test/server'

if (!HTMLDialogElement.prototype.showModal) HTMLDialogElement.prototype.showModal = function showModal() { this.open = true }
if (!HTMLDialogElement.prototype.close) HTMLDialogElement.prototype.close = function close() { this.open = false; this.dispatchEvent(new Event('close')) }

const renderApp = (applicants = createSeedApplicants(12)) => {
  server.use(
    http.get('*/api/applicants', () => HttpResponse.json(applicants)),
    http.get('*/api/positions', () => HttpResponse.json(SEED_POSITIONS)),
  )
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>)
}

afterEach(() => {
  resetMockApiTestConfig()
  localStorage.clear()
})

test('renders the workspace tabs, real summary metrics, and dense applicant table', async () => {
  renderApp()

  expect(await screen.findByRole('table', { name: '지원자 목록' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Applicants/ })).toHaveTextContent('12')
  expect(screen.getByText('전체 지원자')).toBeInTheDocument()
  expect(screen.getByText('오늘 인터뷰')).toBeInTheDocument()
  expect(screen.queryByText('채용 단계 보드')).not.toBeInTheDocument()
})

test('combines owner, no-schedule, and overdue filters and resets them', async () => {
  const applicants = createSeedApplicants(12)
  renderApp(applicants)

  await screen.findByRole('table', { name: '지원자 목록' })
  fireEvent.change(screen.getByLabelText('담당자'), { target: { value: '김하나' } })
  fireEvent.click(screen.getByLabelText('일정 없음'))
  fireEvent.click(screen.getByLabelText('지연됨'))
  fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: '없는 지원자' } })
  expect(screen.getByText('조건에 맞는 지원자가 없습니다.')).toBeInTheDocument()
  fireEvent.click(screen.getAllByRole('button', { name: '필터 초기화' })[0])
  expect(screen.getByRole('table', { name: '지원자 목록' })).toBeInTheDocument()
})

test('opens the context-preserving detail panel and restores trigger focus', async () => {
  renderApp(createSeedApplicants(1))
  const table = await screen.findByRole('table', { name: '지원자 목록' })
  const trigger = within(table).getByRole('button', { name: /김민지/ })
  fireEvent.click(trigger)

  expect(screen.getByRole('complementary', { name: '김민지 상세 정보' })).toBeInTheDocument()
  expect(screen.getByText('타임라인')).toBeInTheDocument()
  const detail = screen.getByRole('complementary', { name: '김민지 상세 정보' })
  expect(within(detail).getByText('Frontend Engineer')).toBeInTheDocument()
  expect(within(detail).queryByText('position-frontend')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' }))
  expect(document.activeElement).toBe(trigger)
})

test('moves ordinary stages without a confirmation and shows the updated row', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  renderApp(createSeedApplicants(1))
  const form = await screen.findByRole('form', { name: '김민지 단계 변경' })
  fireEvent.change(within(form).getByRole('combobox'), { target: { value: 'INTERVIEW' } })
  fireEvent.submit(form)

  expect(screen.queryByRole('heading', { name: '최종 단계 변경' })).not.toBeInTheDocument()
  expect(await screen.findByRole('status')).toHaveTextContent('면접')
  expect(within(form).getByRole('combobox')).toHaveValue('')
})

test('requires confirmation only for terminal stage moves', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  const applicant = { ...createSeedApplicants(1)[0], stage: 'OFFER' as const }
  server.use(http.patch('*/api/applicants/:applicantId/stage', () => HttpResponse.json({ ...applicant, stage: 'HIRED' })))
  renderApp([applicant])
  const form = await screen.findByRole('form', { name: '김민지 단계 변경' })
  fireEvent.change(within(form).getByRole('combobox'), { target: { value: 'HIRED' } })
  fireEvent.submit(form)
  expect(screen.getByRole('heading', { name: '최종 단계 변경' })).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
  expect(await screen.findByRole('status')).toHaveTextContent('최종합격')
})

test('restores the originating stage button focus after terminal cancel and Escape', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  const applicant = { ...createSeedApplicants(1)[0], stage: 'OFFER' as const }
  server.use(http.patch('*/api/applicants/:applicantId/stage', () => HttpResponse.json({ ...applicant, stage: 'HIRED' })))
  renderApp([applicant])
  const form = await screen.findByRole('form', { name: '김민지 단계 변경' })
  const actionButton = within(form).getByRole('button', { name: '적용' })

  fireEvent.change(within(form).getByRole('combobox'), { target: { value: 'HIRED' } })
  fireEvent.submit(form)
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }))
  expect(document.activeElement).toBe(actionButton)

  fireEvent.change(within(form).getByRole('combobox'), { target: { value: 'HIRED' } })
  fireEvent.submit(form)
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(document.activeElement).toBe(actionButton)
})

test('exposes Today, Calendar, and Positions operations views', async () => {
  renderApp(createSeedApplicants(12))
  await screen.findByRole('table', { name: '지원자 목록' })

  fireEvent.click(screen.getByRole('button', { name: /Today/ }))
  expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
  expect(screen.getByText('평가 작성 필요')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: '상세 보기' }).length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: '평가 열기' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '일정 등록' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Calendar/ }))
  expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument()
  expect(screen.getByText('일정 미정')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Positions/ }))
  expect(screen.getByRole('heading', { name: 'Positions' })).toBeInTheDocument()
  expect(screen.getByText('Frontend Engineer')).toBeInTheDocument()
})

test('reports query errors and lets the user retry', async () => {
  let requests = 0
  server.use(
    http.get('*/api/applicants', () => {
      requests += 1
      return requests === 1 ? HttpResponse.json({ message: 'fail' }, { status: 503 }) : HttpResponse.json(createSeedApplicants(1))
    }),
    http.get('*/api/positions', () => HttpResponse.json(SEED_POSITIONS)),
  )
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>)
  expect(await screen.findByRole('alert')).toHaveTextContent('지원자 정보를 불러오지 못했습니다.')
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByRole('table', { name: '지원자 목록' })).toBeInTheDocument()
  expect(requests).toBe(2)
})

test('keeps optimistic rollback scoped to the failed applicant', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  const applicants = createSeedApplicants(2)
  let patchCount = 0
  server.use(
    http.patch('*/api/applicants/:applicantId/stage', ({ params }) => {
      patchCount += 1
      return params.applicantId === applicants[0]?.id
        ? HttpResponse.json({ message: 'fail' }, { status: 503 })
        : HttpResponse.json({ ...applicants[1], stage: 'INTERVIEW' })
    }),
  )
  renderApp(applicants)
  const firstForm = await screen.findByRole('form', { name: '김민지 단계 변경' })
  fireEvent.change(within(firstForm).getByRole('combobox'), { target: { value: 'INTERVIEW' } })
  fireEvent.submit(firstForm)
  const secondForm = screen.getByRole('form', { name: /Alex Kim 단계 변경/ })
  fireEvent.change(within(secondForm).getByRole('combobox'), { target: { value: 'OFFER' } })
  fireEvent.submit(secondForm)
  await waitFor(() => expect(patchCount).toBe(2))
  expect(await screen.findByRole('alert')).toHaveTextContent('이전 상태로 복원')
  expect(screen.getByRole('status')).toHaveTextContent('Alex Kim')
})
