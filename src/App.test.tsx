import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import App from './App'
import { resetMockApiTestConfig, setMockApiTestConfig } from './mocks/mockConfig'
import { createSeedApplicants, SEED_POSITIONS } from './mocks/seedApplicants'
import { server } from './test/server'

if (!HTMLDialogElement.prototype.showModal) HTMLDialogElement.prototype.showModal = function showModal() { this.open = true }
if (!HTMLDialogElement.prototype.close) HTMLDialogElement.prototype.close = function close() { this.open = false; this.dispatchEvent(new Event('close')) }

const renderApp = (applicants = createSeedApplicants(12), strict = false) => {
  server.use(
    http.get('*/api/applicants', () => HttpResponse.json(applicants)),
    http.get('*/api/positions', () => HttpResponse.json(SEED_POSITIONS)),
  )
  const content = <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>
  return render(strict ? <StrictMode>{content}</StrictMode> : content)
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
  const trigger = within(table).getByRole('button', { name: /지원자 상세 보기: 김민지/ })
  fireEvent.click(trigger)

  expect(screen.getByRole('dialog', { name: /김민지/ })).toBeInTheDocument()
  expect(screen.getByText('타임라인')).toBeInTheDocument()
  const detail = screen.getByRole('dialog', { name: /김민지/ })
  expect(within(detail).getByText('Frontend Engineer')).toBeInTheDocument()
  expect(within(detail).queryByText('position-frontend')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' }))
  expect(document.activeElement).toBe(trigger)
})

test('moves ordinary stages without a confirmation and shows the updated row', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  renderApp(createSeedApplicants(1))
  const action = await screen.findByRole('button', { name: '면접 집행 · 김민지 · applicant-001' })
  expect(action).toHaveTextContent('면접 집행')
  expect(action).not.toHaveTextContent('면접으로 진행')
  fireEvent.click(action)

  expect(screen.queryByRole('heading', { name: '단계 변경 확인' })).not.toBeInTheDocument()
  expect(await screen.findByRole('status')).toHaveTextContent('면접')
  const offerAction = screen.getByRole('button', { name: '처우 협의 · 김민지 · applicant-001' })
  expect(offerAction).toHaveTextContent('처우 협의')
  expect(offerAction).not.toHaveTextContent('처우협의로 진행')
})

test('offers exactly destination and rejection actions and requires a rejection reason', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  renderApp(createSeedApplicants(1))
  const reject = await screen.findByRole('button', { name: '불합격 처리 · 김민지 · applicant-001' })
  expect(reject).toHaveTextContent('불합격')
  expect(screen.getByRole('button', { name: '면접 집행 · 김민지 · applicant-001' })).toHaveTextContent('면접 집행')
  fireEvent.click(reject)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
  expect(screen.getByText('불합격 사유를 입력해 주세요.')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('불합격 사유'), { target: { value: '경력 요건 불일치' } })
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
  expect(await screen.findByRole('status')).toHaveTextContent('불합격')
  expect(screen.queryByRole('button', { name: /불합격.*applicant-001/ })).not.toBeInTheDocument()
})

test('reveals every Today queue item instead of silently clipping after eight', async () => {
  const applicants = createSeedApplicants(30).map((applicant) => ({ ...applicant, stage: 'INTERVIEW' as const, schedule: { ...(applicant.schedule ?? { date: '2026-09-08', startTime: '09:00', endTime: '10:00', format: 'VIDEO' as const, interviewer: '김하나' }), date: '2026-09-08' } }))
  renderApp(applicants)
  await screen.findByRole('table', { name: '지원자 목록' })
  fireEvent.click(screen.getByRole('button', { name: /Today/ }))
  expect(screen.getAllByText('30').length).toBeGreaterThan(0)
  expect(screen.getAllByRole('button', { name: /상세 보기:/ }).length).toBeGreaterThan(8)
})

test('shows a positions retry error from Applicants rather than silently hiding position data', async () => {
  let requests = 0
  server.use(http.get('*/api/applicants', () => HttpResponse.json(createSeedApplicants(1))), http.get('*/api/positions', () => { requests += 1; return requests === 1 ? HttpResponse.json({ message: 'fail' }, { status: 503 }) : HttpResponse.json(SEED_POSITIONS) }))
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>)
  await screen.findByRole('table', { name: '지원자 목록' })
  expect(await screen.findByRole('alert')).toHaveTextContent('포지션 정보를 불러오지 못했습니다.')
  fireEvent.click(screen.getByRole('button', { name: '포지션 정보 다시 시도' }))
  await waitFor(() => expect(requests).toBe(2))
})

test('toggles the detail from a unique applicant button and moves focus into the mobile-safe dialog', async () => {
  renderApp([{ ...createSeedApplicants(1)[0], name: '동명이인' }, { ...createSeedApplicants(2)[1], name: '동명이인' }])
  const table = await screen.findByRole('table', { name: '지원자 목록' })
  const triggers = within(table).getAllByRole('button', { name: /지원자 상세 보기: 동명이인/ })
  expect(new Set(triggers.map((trigger) => trigger.getAttribute('aria-label'))).size).toBe(2)
  fireEvent.click(triggers[0]!)
  const dialog = await screen.findByRole('dialog', { name: /동명이인/ })
  expect(dialog).toContainElement(screen.getByRole('button', { name: '상세 패널 닫기' }))
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '상세 패널 닫기' }))
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: /동명이인/ })).not.toBeInTheDocument()
  expect(document.activeElement).toBe(triggers[0])
  fireEvent.click(triggers[1]!)
  expect(screen.getByRole('dialog', { name: /동명이인/ })).toBeInTheDocument()
  fireEvent.click(triggers[1]!)
  expect(screen.queryByRole('dialog', { name: /동명이인/ })).not.toBeInTheDocument()
})

test('requires confirmation only for terminal stage moves', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  const applicant = { ...createSeedApplicants(1)[0], stage: 'OFFER' as const }
  server.use(http.patch('*/api/applicants/:applicantId/stage', () => HttpResponse.json({ ...applicant, stage: 'HIRED' })))
  renderApp([applicant])
  const actionButton = await screen.findByRole('button', { name: '최종 합격 · 김민지 · applicant-001' })
  expect(actionButton).toHaveTextContent('최종 합격')
  expect(actionButton).not.toHaveTextContent('최종합격 처리')
  fireEvent.click(actionButton)
  expect(screen.getByRole('heading', { name: '단계 변경 확인' })).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
  expect(await screen.findByRole('status')).toHaveTextContent('최종합격')
})

test('keeps terminal confirmation open in StrictMode and restores originating focus', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  const applicant = { ...createSeedApplicants(1)[0], stage: 'OFFER' as const }
  let patchCount = 0
  server.use(http.patch('*/api/applicants/:applicantId/stage', () => { patchCount += 1; return HttpResponse.json({ ...applicant, stage: 'HIRED' }) }))
  renderApp([applicant], true)
  const actionButton = await screen.findByRole('button', { name: '최종 합격 · 김민지 · applicant-001' })

  fireEvent.click(actionButton)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }))
  expect(document.activeElement).toBe(actionButton)
  expect(patchCount).toBe(0)

  fireEvent.click(actionButton)
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(document.activeElement).toBe(actionButton)
  expect(patchCount).toBe(0)
})

test('exposes Today, Calendar, and Positions operations views', async () => {
  renderApp(createSeedApplicants(12))
  await screen.findByRole('table', { name: '지원자 목록' })

  fireEvent.click(screen.getByRole('button', { name: /Today/ }))
  expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument()
  expect(screen.getByText('평가 작성 필요')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /상세 보기:/ }).length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: '평가 열기' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '일정 등록' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Calendar/ }))
  expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument()
  expect(screen.getByText('일정 미정')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Positions/ }))
  expect(screen.getByRole('heading', { name: 'Positions' })).toBeInTheDocument()
  expect(screen.getByText('Frontend Engineer')).toBeInTheDocument()
})

test('retries applicants after one initial failure and exposes the active refetch', async () => {
  let requests = 0
  server.use(
    http.get('*/api/applicants', () => {
      requests += 1
      if (requests === 1) return HttpResponse.json({ message: 'fail' }, { status: 503 })
      return new Promise((resolve) => setTimeout(() => resolve(HttpResponse.json(createSeedApplicants(1))), 50))
    }),
    http.get('*/api/positions', () => HttpResponse.json(SEED_POSITIONS)),
  )
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>)
  expect(await screen.findByRole('alert')).toHaveTextContent('지원자 정보를 불러오지 못했습니다.')
  const retryButton = screen.getByRole('button', { name: '다시 시도' })
  fireEvent.click(retryButton)
  await waitFor(() => expect(retryButton).toBeDisabled())
  expect(screen.getByRole('alert')).toHaveAttribute('aria-busy', 'true')
  fireEvent.click(retryButton)
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
  const firstAction = await screen.findByRole('button', { name: '면접 집행 · 김민지 · applicant-001' })
  fireEvent.click(firstAction)
  const secondAction = screen.getByRole('button', { name: '처우 협의 · Alex Kim · applicant-002' })
  fireEvent.click(secondAction)
  await waitFor(() => expect(patchCount).toBe(2))
  expect(await screen.findByRole('alert')).toHaveTextContent('이전 상태로 복원')
  expect(screen.getByRole('status')).toHaveTextContent('Alex Kim')
})

test('submits the current-stage feedback from the detail panel', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  renderApp(createSeedApplicants(1))
  const table = await screen.findByRole('table', { name: '지원자 목록' })
  fireEvent.click(within(table).getByRole('button', { name: /지원자 상세 보기: 김민지/ }))

  const form = screen.getByRole('form', { name: '서류검토 피드백' })
  fireEvent.change(within(form).getByLabelText('평가자'), { target: { value: '이서준' } })
  fireEvent.change(within(form).getByLabelText('점수'), { target: { value: '88' } })
  fireEvent.change(within(form).getByLabelText('코멘트'), { target: { value: '문제 해결 근거가 명확합니다.' } })
  fireEvent.click(within(form).getByRole('button', { name: '피드백 저장' }))

  expect(await screen.findByRole('status')).toHaveTextContent('피드백을 저장했습니다')
  const dialog = screen.getByRole('dialog', { name: /김민지/ })
  expect(within(dialog).getByText('문제 해결 근거가 명확합니다.')).toBeInTheDocument()
  expect(within(dialog).getByText(/이서준 · 작성/)).toBeInTheDocument()
  expect(screen.queryByRole('form', { name: '서류검토 피드백' })).not.toBeInTheDocument()
})

test('keeps feedback input after a failed save', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  server.use(http.patch('*/api/applicants/:applicantId/evaluations/:evaluationId', () =>
    HttpResponse.json({ code: 'MOCK_FAILURE' }, { status: 503 })))
  renderApp(createSeedApplicants(1))
  const table = await screen.findByRole('table', { name: '지원자 목록' })
  fireEvent.click(within(table).getByRole('button', { name: /지원자 상세 보기: 김민지/ }))

  const form = screen.getByRole('form', { name: '서류검토 피드백' })
  fireEvent.change(within(form).getByLabelText('점수'), { target: { value: '88' } })
  fireEvent.change(within(form).getByLabelText('코멘트'), { target: { value: '입력 유지 확인' } })
  fireEvent.click(within(form).getByRole('button', { name: '피드백 저장' }))

  expect(await within(form).findByRole('alert')).toHaveTextContent('피드백을 저장하지 못했습니다')
  expect(within(form).getByLabelText('점수')).toHaveValue(88)
  expect(within(form).getByLabelText('코멘트')).toHaveValue('입력 유지 확인')
})

test('blocks duplicate feedback submissions for the same applicant', async () => {
  const applicant = createSeedApplicants(1)[0]!
  const evaluation = applicant.evaluations![0]!
  let patchCount = 0
  let releaseRequest: (() => void) | undefined
  server.use(http.patch('*/api/applicants/:applicantId/evaluations/:evaluationId', async () => {
    patchCount += 1
    await new Promise<void>((resolve) => { releaseRequest = resolve })
    return HttpResponse.json({
      ...applicant,
      evaluations: [{
        ...evaluation,
        status: 'SUBMITTED',
        score: 88,
        comment: '중복 제출 방지',
        submittedAt: '2026-09-08',
      }],
    })
  }))
  renderApp([applicant])
  const table = await screen.findByRole('table', { name: '지원자 목록' })
  fireEvent.click(within(table).getByRole('button', { name: /지원자 상세 보기: 김민지/ }))

  const form = screen.getByRole('form', { name: '서류검토 피드백' })
  fireEvent.change(within(form).getByLabelText('점수'), { target: { value: '88' } })
  fireEvent.change(within(form).getByLabelText('코멘트'), { target: { value: '중복 제출 방지' } })
  fireEvent.click(within(form).getByRole('button', { name: '피드백 저장' }))
  expect(form).toHaveAttribute('aria-busy', 'true')
  expect(within(form).getByRole('button', { name: '저장 중' })).toBeDisabled()
  fireEvent.submit(form)
  await waitFor(() => expect(patchCount).toBe(1))

  releaseRequest?.()
  expect(await screen.findByRole('status')).toHaveTextContent('피드백을 저장했습니다')
  expect(patchCount).toBe(1)
})
