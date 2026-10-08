import { saveApplicants } from './mocks/mockDb'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { toast } from 'sonner'
import { http, HttpResponse } from 'msw'
import App from './App'
import { applicantsQueryKey } from './features/recruitment-board/api/useApplicantsQuery'
import { resetMockApiTestConfig, setMockApiTestConfig } from './mocks/mockConfig'
import { createSeedApplicants as seedApplicants, SEED_POSITIONS } from './mocks/seedApplicants'
import { server } from './test/server'
import type { Applicant } from './features/recruitment-board/model/applicant.types'

if (!HTMLDialogElement.prototype.showModal) HTMLDialogElement.prototype.showModal = function showModal() { this.open = true }
if (!HTMLDialogElement.prototype.close) HTMLDialogElement.prototype.close = function close() { this.open = false; this.dispatchEvent(new Event('close')) }

// Equal dates keep ID-based interaction fixtures stable; sorting tests override dates explicitly.
const createSeedApplicants = (count: number): Applicant[] => seedApplicants(count).map((item) => ({ ...item, appliedAt: '2026-09-01', evaluations: [{ ...item.evaluations![0], type: ({ DOCUMENT_REVIEW: 'SCREEN', INTERVIEW: 'INTERVIEW', OFFER: 'FINAL', HIRED: 'FINAL', REJECTED: 'FINAL' } as const)[item.stage], status: 'SUBMITTED' as const, score: 80, comment: '검증된 평가' }], schedule: item.stage === 'INTERVIEW' && item.schedule ? { ...item.schedule, status: 'COMPLETED' as const } : item.schedule }))
const successToast = () => screen.findByText(/님을 .+으로 이동했습니다\.|님의 피드백을 저장했습니다\./)
const openFilters = () => fireEvent.click(screen.getByRole('button', { name: /추가 필터/ }))

const renderApp = (applicants = createSeedApplicants(12), strict = false) => {
  let applicantRequests = 0
  server.use(
    http.get('*/api/applicants', () => { applicantRequests += 1; return HttpResponse.json(applicants) }),
    http.get('*/api/positions', () => HttpResponse.json(SEED_POSITIONS)),
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const content = <QueryClientProvider client={queryClient}><App /></QueryClientProvider>
  return { ...render(strict ? <StrictMode>{content}</StrictMode> : content), queryClient, applicantRequests: () => applicantRequests }
}

afterEach(() => {
  toast.dismiss()
  window.getSelection()?.removeAllRanges()
  resetMockApiTestConfig()
  localStorage.clear()
  sessionStorage.clear()
})

test('renders the workspace tabs, real summary metrics, and dense applicant table', async () => {
  renderApp()

  expect(await screen.findByRole('table', { name: '지원자 목록' })).toBeInTheDocument()
  expect(within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' })).getByRole('button', { name: /^지원자/ })).toHaveTextContent('12')
  expect(screen.getByRole('heading', { name: '지원자 12' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: '요약 지표' })).not.toBeInTheDocument()
  expect(screen.queryByText('채용 단계 보드')).not.toBeInTheDocument()
})

test('combines owner, no-schedule, and overdue filters and resets them', async () => {
  const applicants = createSeedApplicants(12)
  renderApp(applicants)

  await screen.findByRole('table', { name: '지원자 목록' })
  openFilters()
  fireEvent.change(screen.getByLabelText('담당자'), { target: { value: '김하나' } })
  fireEvent.click(screen.getByLabelText('일정 없음'))
  fireEvent.click(screen.getByLabelText('기한 초과'))
  fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: '없는 지원자' } })
  expect(screen.getByText('조건에 맞는 지원자가 없습니다.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '초기화' }))
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
  expect(within(detail).getAllByText('Frontend Engineer').length).toBeGreaterThan(0)
  expect(within(detail).queryByText('position-frontend')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' }))
  expect(document.activeElement).toBe(trigger)
})

test('moves ordinary stages without a confirmation and shows the updated row', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  saveApplicants(createSeedApplicants(1))
  renderApp(createSeedApplicants(1))
  const action = await screen.findByRole('button', { name: '면접 집행 · 김민지 · applicant-001' })
  expect(action).toHaveTextContent('면접 집행')
  expect(action).not.toHaveTextContent('면접으로 진행')
  fireEvent.click(action)

  expect(screen.queryByRole('heading', { name: '단계 변경 확인' })).not.toBeInTheDocument()
  expect(await successToast()).toHaveTextContent('면접')
  const offerAction = screen.getByRole('button', { name: '처우 협의 · 김민지 · applicant-001' })
  expect(offerAction).toHaveTextContent('처우 협의')
  expect(offerAction).not.toHaveTextContent('처우협의로 진행')
})

test('offers exactly destination and rejection actions and requires a rejection reason', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  renderApp(createSeedApplicants(1))
  const menu = await screen.findByRole('button', { name: '더 보기 · 김민지 · applicant-001' })
  fireEvent.keyDown(menu, { key: 'Enter' })
  const reject = await screen.findByRole('menuitem', { name: '불합격 처리 · 김민지 · applicant-001' })
  expect(reject).toHaveTextContent('불합격 처리')
  fireEvent.click(reject)
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
  expect(screen.getByText('불합격 사유를 입력해 주세요.')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('불합격 사유'), { target: { value: '경력 요건 불일치' } })
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
  expect(await successToast()).toHaveTextContent('불합격')
  expect(screen.queryByRole('button', { name: /불합격.*applicant-001/ })).not.toBeInTheDocument()
})

test('reveals every Today queue item instead of silently clipping after eight', async () => {
  const applicants = createSeedApplicants(30).map((applicant) => ({ ...applicant, stage: 'INTERVIEW' as const, schedule: { ...(applicant.schedule ?? { date: '2026-09-08', startTime: '09:00', endTime: '10:00', format: 'VIDEO' as const, interviewer: '김하나' }), date: '2026-09-08' } }))
  renderApp(applicants)
  await screen.findByRole('table', { name: '지원자 목록' })
  fireEvent.click(screen.getByRole('button', { name: /^오늘 할 일/ }))
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
  const applicant = { ...createSeedApplicants(1)[0], stage: 'OFFER' as const, evaluations: [{ ...createSeedApplicants(1)[0].evaluations![0], type: 'FINAL' as const }] }
  server.use(http.patch('*/api/applicants/:applicantId/stage', () => HttpResponse.json({ ...applicant, stage: 'HIRED' })))
  renderApp([applicant])
  const actionButton = await screen.findByRole('button', { name: '최종 합격 · 김민지 · applicant-001' })
  expect(actionButton).toHaveTextContent('최종 합격')
  expect(actionButton).not.toHaveTextContent('최종합격 처리')
  fireEvent.click(actionButton)
  expect(screen.getByRole('heading', { name: '단계 변경 확인' })).toBeInTheDocument()
  expect(screen.queryByText(/님을 .+으로 이동했습니다\./)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
  expect(await successToast()).toHaveTextContent('최종합격')
})

test('keeps terminal confirmation open in StrictMode and restores originating focus', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  const applicant = { ...createSeedApplicants(1)[0], stage: 'OFFER' as const, evaluations: [{ ...createSeedApplicants(1)[0].evaluations![0], type: 'FINAL' as const }] }
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

  fireEvent.click(screen.getByRole('button', { name: /^오늘 할 일/ }))
  expect(screen.getByRole('heading', { name: '오늘 할 일' })).toBeInTheDocument()
  expect(screen.getByText('평가 작성 필요')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /상세 보기:/ }).length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: '평가 열기' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '일정 등록' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /^캘린더/ }))
  expect(screen.getByRole('heading', { name: '캘린더' })).toBeInTheDocument()
  expect(screen.getByText('일정 미정')).toBeInTheDocument()

  fireEvent.click(within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' })).getByRole('button', { name: /^포지션/ }))
  expect(screen.getByRole('heading', { name: '포지션' })).toBeInTheDocument()
  expect(within(screen.getByRole('table', { name: '포지션 목록' })).getByText('Frontend Engineer')).toBeInTheDocument()
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
  const failure = await screen.findByText(/이전 상태로 복원했습니다/)
  expect(failure).toHaveTextContent('이전 상태로 복원')
  const success = screen.getByText(/님을 .+으로 이동했습니다\.|님의 피드백을 저장했습니다\./)
  expect(success).toHaveTextContent('Alex Kim')
  fireEvent.click(within(failure.closest('li')!).getByRole('button', { name: '알림 닫기' }))
  await waitFor(() => expect(failure).not.toBeInTheDocument())
  expect(success).toBeInTheDocument()
})

test('submits the current-stage feedback from the detail panel', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  const feedbackApplicant = createSeedApplicants(1)[0]!
  feedbackApplicant.evaluations![0].status = 'PENDING'
  renderApp([feedbackApplicant])
  const table = await screen.findByRole('table', { name: '지원자 목록' })
  fireEvent.click(within(table).getByRole('button', { name: /지원자 상세 보기: 김민지/ }))

  const form = screen.getByRole('form', { name: '서류검토 피드백' })
  fireEvent.change(within(form).getByLabelText('평가자'), { target: { value: '이서준' } })
  fireEvent.change(within(form).getByLabelText('점수'), { target: { value: '88' } })
  fireEvent.change(within(form).getByLabelText('코멘트'), { target: { value: '문제 해결 근거가 명확합니다.' } })
  fireEvent.click(within(form).getByRole('button', { name: '피드백 저장' }))

  expect(await successToast()).toHaveTextContent('피드백을 저장했습니다')
  const dialog = screen.getByRole('dialog', { name: /김민지/ })
  expect(within(dialog).getByText('문제 해결 근거가 명확합니다.')).toBeInTheDocument()
  expect(within(dialog).getByText(/이서준 · 작성/)).toBeInTheDocument()
  expect(screen.queryByRole('form', { name: '서류검토 피드백' })).not.toBeInTheDocument()
})

test('keeps feedback input after a failed save', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  server.use(http.patch('*/api/applicants/:applicantId/evaluations/:evaluationId', () =>
    HttpResponse.json({ code: 'MOCK_FAILURE' }, { status: 503 })))
  const feedbackApplicant = createSeedApplicants(1)[0]!
  feedbackApplicant.evaluations![0].status = 'PENDING'
  renderApp([feedbackApplicant])
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
  applicant.evaluations![0].status = 'PENDING'
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
  expect(await successToast()).toHaveTextContent('피드백을 저장했습니다')
  expect(patchCount).toBe(1)
})


const tableRows = () => within(screen.getByRole('table', { name: '지원자 목록' })).getAllByRole('row').slice(1)
const pageStatus = () => screen.getByRole('status', { name: '지원자 페이지 상태' })

test('places display size and result range between stage filters and the table, with page navigation below', async () => {
  renderApp(createSeedApplicants(240))
  const table = await screen.findByRole('table', { name: '지원자 목록' })
  const stages = screen.getByRole('navigation', { name: '단계별 지원자 필터' })
  const select = screen.getByLabelText('페이지당 표시')
  const pager = screen.getByRole('navigation', { name: '지원자 페이지 탐색' })
  for (const control of [select, pageStatus()]) {
    expect(stages.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(control.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }
  expect(table.compareDocumentPosition(pager) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('pages all 240 IDs once without fetching or changing the full cache/storage', async () => {
  const applicants = createSeedApplicants(240)
  const storageBefore = localStorage.getItem('recruitment-pipeline-board:applicants:v1')
  const app = renderApp(applicants)
  const table = await screen.findByRole('table', { name: '지원자 목록' })
  const pager = within(screen.getByRole('navigation', { name: '지원자 페이지 탐색' }))
  expect(tableRows().length).toBe(20)
  expect(pageStatus()).toHaveTextContent('총 240명')
  expect(pageStatus()).toHaveTextContent('총 240명 · 1–20명')
  expect(pageStatus()).toHaveTextContent('1 / 12 페이지')
  expect(pager.getByRole('button', { name: '이전 페이지' })).toBeDisabled()
  const ids: string[] = []
  for (let page = 1; page <= 12; page += 1) {
    ids.push(...within(table).getAllByRole('button', { name: /^지원자 상세 보기:/ }).map((button) => button.getAttribute('aria-label')!.split(' · ').at(-1)!))
    if (page < 12) fireEvent.click(pager.getByRole('button', { name: '다음 페이지' }))
  }
  expect(ids).toEqual(applicants.map(({ id }) => id))
  expect(pageStatus()).toHaveTextContent('총 240명 · 221–240명')
  expect(pager.getByRole('button', { name: '다음 페이지' })).toBeDisabled()
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: /^지원자 \d/ }))
  expect(app.applicantRequests()).toBe(1)
  expect(app.queryClient.getQueryData(applicantsQueryKey)).toEqual(applicants)
  expect(localStorage.getItem('recruitment-pipeline-board:applicants:v1')).toBe(storageBefore)
}, 10_000)

test.each([50, 100])('resets to page one for size %i, preserves select focus, and keeps the final 40 rows', async (size) => {
  renderApp(createSeedApplicants(240))
  await screen.findByRole('table', { name: '지원자 목록' })
  const pager = within(screen.getByRole('navigation', { name: '지원자 페이지 탐색' }))
  fireEvent.click(pager.getByRole('button', { name: '다음 페이지' }))
  const select = screen.getByLabelText('페이지당 표시')
  select.focus()
  fireEvent.change(select, { target: { value: String(size) } })
  expect(tableRows().length).toBe(size)
  expect(pageStatus()).toHaveTextContent(`1 / ${Math.ceil(240 / size)} 페이지`)
  expect(document.activeElement).toBe(select)
  for (let page = 1; page < Math.ceil(240 / size); page += 1) fireEvent.click(pager.getByRole('button', { name: '다음 페이지' }))
  expect(tableRows().length).toBe(40)
  fireEvent.change(select, { target: { value: '30' } })
  expect(tableRows().length).toBe(40)
}, 10_000)

test.each(['이름 검색', '직무', '담당자', '포지션', '단계', '일정 없음', '기한 초과', '초기화'])('resets the page at the %s change event', async (filter) => {
  renderApp(createSeedApplicants(240))
  await screen.findByRole('table', { name: '지원자 목록' })
  fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
  if (['담당자', '포지션', '일정 없음', '기한 초과'].includes(filter)) openFilters()
  if (filter === '초기화') {
    fireEvent.change(screen.getByLabelText('직무'), { target: { value: 'Frontend Developer' } })
    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
    expect(pageStatus()).toHaveTextContent('2 /')
  }
  if (filter === '단계') fireEvent.click(screen.getByRole('button', { name: /^서류검토 / }))
  else if (filter === '초기화') fireEvent.click(screen.getByRole('button', { name: filter }))
  else if (filter === '일정 없음' || filter === '기한 초과') fireEvent.click(screen.getByLabelText(filter))
  else {
    const value = { '이름 검색': '김', '직무': 'Frontend Developer', '담당자': '김하나', '포지션': 'position-frontend' }[filter]
    const control = screen.getByLabelText(filter)
    control.focus()
    fireEvent.change(control, { target: { value } })
    expect(document.activeElement).toBe(control)
  }
  expect(pageStatus()).toHaveTextContent('1 /')
  expect(screen.getByLabelText('페이지당 표시')).toHaveValue('20')
})

test('resets same-count searches and preserves tab context', async () => {
  const applicants = createSeedApplicants(240).map((applicant, index) => ({ ...applicant, name: index < 120 ? 'Alpha' : 'Beta' }))
  renderApp(applicants)
  await screen.findByRole('table', { name: '지원자 목록' })
  fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: 'Alpha' } })
  fireEvent.change(screen.getByLabelText('페이지당 표시'), { target: { value: '50' } })
  fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
  fireEvent.click(screen.getByRole('button', { name: /^오늘 할 일/ }))
  expect(screen.getAllByRole('button', { name: /상세 보기:/ }).length).toBeGreaterThan(50)
  fireEvent.click(within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' })).getByRole('button', { name: /^지원자/ }))
  expect(screen.getByLabelText('이름 검색')).toHaveValue('Alpha')
  expect(pageStatus()).toHaveTextContent('2 / 3 페이지')
  expect(screen.getByLabelText('페이지당 표시')).toHaveValue('50')
  fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: 'Beta' } })
  expect(pageStatus()).toHaveTextContent('1 / 3 페이지')
})

test('applies position navigation with page one while preserving page size', async () => {
  const applicants = createSeedApplicants(240).map((applicant, index) => ({ ...applicant, name: index < 120 ? 'Alpha' : 'Beta' }))
  renderApp(applicants)
  await screen.findByRole('table', { name: '지원자 목록' })
  fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: 'Beta' } })
  fireEvent.change(screen.getByLabelText('페이지당 표시'), { target: { value: '50' } })
  fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
  expect(pageStatus()).toHaveTextContent('2 / 3 페이지')
  fireEvent.click(within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' })).getByRole('button', { name: /^포지션/ }))
  fireEvent.click(screen.getAllByRole('button', { name: '지원자 보기' })[0]!)
  openFilters()
  expect(screen.getByLabelText('포지션')).toHaveValue(SEED_POSITIONS[0]!.id)
  expect(screen.getByLabelText('이름 검색')).toHaveValue('')
  expect(pageStatus()).toHaveTextContent('1 / 1 페이지')
  expect(screen.getByLabelText('페이지당 표시')).toHaveValue('50')
})

test.each([1, 20])('shows a disabled pager for %i applicants and hides it on filtered empty', async (size) => {
  renderApp(createSeedApplicants(size))
  await screen.findByRole('table', { name: '지원자 목록' })
  expect(screen.getByRole('navigation', { name: '지원자 페이지 탐색' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '이전 페이지' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '다음 페이지' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: '없는 지원자' } })
  expect(screen.getByText('조건에 맞는 지원자가 없습니다.')).toBeInTheDocument()
  expect(pageStatus()).toHaveTextContent('총 0명')
  expect(screen.queryByRole('navigation', { name: '지원자 페이지 탐색' })).not.toBeInTheDocument()
  expect(screen.queryByText(/1–0명|1 \/ 0 페이지/)).not.toBeInTheDocument()
})

test('preserves the dedicated original-empty state', async () => {
  renderApp([])
  expect(await screen.findByRole('heading', { name: '등록된 지원자가 없습니다.' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: '지원자 페이지 탐색' })).not.toBeInTheDocument()
})

test('clamps the vanished last page, keeps detail and failed rollback, and restores fallback focus', async () => {
  const applicants = createSeedApplicants(21).map((applicant) => ({ ...applicant, stage: 'DOCUMENT_REVIEW' as const, evaluations: [{ ...applicant.evaluations![0], type: 'SCREEN' as const }] }))
  let release: (() => void) | undefined
  server.use(http.patch('*/api/applicants/:applicantId/stage', async () => {
    await new Promise<void>((resolve) => { release = resolve })
    return HttpResponse.json({ code: 'MOCK_FAILURE' }, { status: 503 })
  }))
  const app = renderApp(applicants)
  await screen.findByRole('table', { name: '지원자 목록' })
  fireEvent.click(screen.getByRole('button', { name: /^서류검토 / }))
  fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
  const last = applicants[20]!
  fireEvent.click(screen.getByRole('button', { name: `지원자 상세 보기: ${last.name} · ${last.id}` }))
  const detail = screen.getByRole('dialog')
  fireEvent.click(within(detail).getByRole('button', { name: `면접 집행 · ${last.name} · ${last.id}` }))
  await waitFor(() => expect(pageStatus()).toHaveTextContent('1 / 1 페이지'))
  expect(tableRows().length).toBe(20)
  expect(within(within(detail).getByRole('group', { name: '현재 채용 단계' })).getByText('면접')).toBeInTheDocument()
  expect(detail).toContainElement(document.activeElement as HTMLElement)
  await waitFor(() => expect(release).toBeTypeOf('function'))
  release?.()
  const alert = await screen.findByText(/이전 상태로 복원했습니다/)
  expect(alert).toHaveTextContent(last.name)
  expect(alert).toHaveTextContent(last.id)
  expect(pageStatus()).toHaveTextContent('1 / 2 페이지')
  expect(tableRows().length).toBe(20)
  expect(app.queryClient.getQueryData(applicantsQueryKey)).toEqual(applicants)
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' }))
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: /^지원자 \d/ }))
  fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
  expect(tableRows().length).toBe(1)
})

test('restores heading focus when a focused action row disappears and preserves unrelated input focus', async () => {
  const applicants = createSeedApplicants(21).map((applicant) => ({ ...applicant, stage: 'DOCUMENT_REVIEW' as const, evaluations: [{ ...applicant.evaluations![0], type: 'SCREEN' as const }] }))
  const last = applicants[20]!
  server.use(http.patch('*/api/applicants/:applicantId/stage', () => HttpResponse.json({ ...last, stage: 'INTERVIEW' })))
  renderApp(applicants)
  await screen.findByRole('table', { name: '지원자 목록' })
  fireEvent.click(screen.getByRole('button', { name: /^서류검토 / }))
  fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
  const action = screen.getByRole('button', { name: `면접 집행 · ${last.name} · ${last.id}` })
  action.focus()
  fireEvent.click(action)
  await waitFor(() => expect(pageStatus()).toHaveTextContent('1 / 1 페이지'))
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: /^지원자 \d/ }))
  const input = screen.getByLabelText('이름 검색')
  input.focus()
  await successToast()
  expect(document.activeElement).toBe(input)
})

test('allows page navigation while pending, blocks the same ID, and rolls back only A after B succeeds on another page', async () => {
  const applicants = createSeedApplicants(21)
  const first = applicants[0]!, last = applicants[20]!
  const releases = new Map<string, () => void>()
  let patches = 0
  server.use(http.patch('*/api/applicants/:applicantId/stage', async ({ params }) => {
    patches += 1
    const id = String(params.applicantId)
    await new Promise<void>((resolve) => { releases.set(id, resolve) })
    return id === first.id ? HttpResponse.json({ code: 'MOCK_FAILURE' }, { status: 503 }) : HttpResponse.json({ ...last, stage: 'INTERVIEW' })
  }))
  const app = renderApp(applicants)
  const action = await screen.findByRole('button', { name: `면접 집행 · ${first.name} · ${first.id}` })
  fireEvent.click(action)
  fireEvent.click(action)
  await waitFor(() => expect(releases.has(first.id)).toBe(true))
  expect(action).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
  fireEvent.click(screen.getByRole('button', { name: `면접 집행 · ${last.name} · ${last.id}` }))
  await waitFor(() => expect(releases.has(last.id)).toBe(true))
  releases.get(last.id)!()
  await successToast()
  fireEvent.click(screen.getByRole('button', { name: '이전 페이지' }))
  expect(screen.getByRole('button', { name: `처우 협의 · ${first.name} · ${first.id}` })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
  releases.get(first.id)!()
  expect(await screen.findByText(/이전 상태로 복원했습니다/)).toHaveTextContent(first.id)
  expect(screen.getByText(/님을 .+으로 이동했습니다\.|님의 피드백을 저장했습니다\./)).toHaveTextContent(last.name)
  expect(app.queryClient.getQueryData(applicantsQueryKey)).toEqual(applicants.map((applicant) => applicant.id === last.id ? { ...last, stage: 'INTERVIEW' } : applicant))
  expect(patches).toBe(2)
  expect(app.applicantRequests()).toBe(1)
})


test('uses compact applicant summary and keeps full metrics on other tabs', async () => {
  renderApp(createSeedApplicants(240))
  await screen.findByRole('table', { name: '지원자 목록' })
  expect(screen.getByRole('heading', { name: '지원자 240' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: '요약 지표' })).not.toBeInTheDocument()
  expect(screen.getByText(/진행 중 .*평가 대기/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /^오늘 할 일/ }))
  expect(screen.getByRole('region', { name: '요약 지표' })).toBeInTheDocument()
})

test('keeps advanced filters effective when collapsed and restores focus after the last chip removal', async () => {
  renderApp(createSeedApplicants(240))
  await screen.findByRole('table', { name: '지원자 목록' })
  expect(screen.queryByLabelText('담당자')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /추가 필터/ }))
  fireEvent.change(screen.getByLabelText('담당자'), { target: { value: '이서준' } })
  const toggle = screen.getByRole('button', { name: /추가 필터/ })
  screen.getByLabelText('담당자').focus()
  fireEvent.click(toggle)
  expect(document.activeElement).toBe(toggle)
  expect(screen.queryByLabelText('담당자')).not.toBeInTheDocument()
  expect(pageStatus()).toHaveTextContent('총 60명')
  const chip = screen.getByRole('button', { name: '담당자 이서준 필터 해제' })
  chip.focus()
  fireEvent.click(chip)
  expect(pageStatus()).toHaveTextContent('총 240명')
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('이름 검색')))
})

test('opens detail from a general cell and row space but excludes selected text and actions', async () => {
  renderApp(createSeedApplicants(1))
  const table = await screen.findByRole('table', { name: '지원자 목록' })
  const row = within(table).getAllByRole('row')[1]!
  const trigger = within(row).getByRole('button', { name: /지원자 상세 보기:/ })
  fireEvent.click(within(row).getByText('김하나'))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' }))
  expect(document.activeElement).toBe(trigger)
  fireEvent.click(row)
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' }))
  const selection = window.getSelection()!
  const range = document.createRange()
  range.selectNodeContents(within(row).getByText('김하나'))
  selection.removeAllRanges()
  selection.addRange(range)
  expect(selection.toString()).toBe('김하나')
  fireEvent.click(row)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  selection.removeAllRanges()
  fireEvent.keyDown(within(row).getByRole('button', { name: /더 보기/ }), { key: 'Enter' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: /불합격 처리/ })).toBeInTheDocument()
})

test('sorts before pagination, resets sort changes, and preserves sort and size across filters and tabs', async () => {
  const applicants: Applicant[] = createSeedApplicants(60).map((item, index) => ({ ...item, stage: 'DOCUMENT_REVIEW' as const, appliedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(), dueDate: undefined }))
  applicants[0]!.dueDate = '2026-01-01'
  const app = renderApp(applicants)
  await screen.findByRole('table', { name: '지원자 목록' })
  expect(within(tableRows()[0]!).getByRole('button', { name: /지원자 상세 보기:/ })).toHaveAccessibleName(`지원자 상세 보기: ${applicants[59]!.name} · ${applicants[59]!.id}`)
  fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
  const sort = screen.getByLabelText('정렬')
  sort.focus()
  fireEvent.change(sort, { target: { value: 'DUE' } })
  expect(pageStatus()).toHaveTextContent('1 / 3 페이지')
  expect(document.activeElement).toBe(sort)
  expect(within(tableRows()[0]!).getByRole('button', { name: /지원자 상세 보기:/ })).toHaveAccessibleName(`지원자 상세 보기: ${applicants[0]!.name} · ${applicants[0]!.id}`)
  fireEvent.change(sort, { target: { value: 'OVERDUE' } })
  fireEvent.change(screen.getByLabelText('페이지당 표시'), { target: { value: '50' } })
  fireEvent.change(screen.getByLabelText('직무'), { target: { value: 'Frontend Developer' } })
  fireEvent.click(screen.getByRole('button', { name: '초기화' }))
  expect(screen.getByLabelText('정렬')).toHaveValue('OVERDUE')
  expect(screen.getByLabelText('페이지당 표시')).toHaveValue('50')
  fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
  fireEvent.click(screen.getByRole('button', { name: /^오늘 할 일/ }))
  fireEvent.click(within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' })).getByRole('button', { name: /^지원자/ }))
  expect(pageStatus()).toHaveTextContent('2 / 2 페이지')
  expect(screen.getByLabelText('정렬')).toHaveValue('OVERDUE')
  expect(app.queryClient.getQueryData(applicantsQueryKey)).toEqual(applicants)
  expect(app.applicantRequests()).toBe(1)
})

test('keeps failure A after success B expires and replaces only A on retry, with one stable modal live region', async () => {
  const applicants = createSeedApplicants(2).map((item) => ({ ...item, stage: 'DOCUMENT_REVIEW' as const, evaluations: [{ ...item.evaluations![0], type: 'SCREEN' as const }] }))
  const [first, second] = applicants
  let failed = false
  server.use(http.patch('*/api/applicants/:id/stage', ({ params }) => {
    if (params.id === first!.id && !failed) { failed = true; return HttpResponse.json({ code: 'MOCK_FAILURE' }, { status: 503 }) }
    return HttpResponse.json({ ...applicants.find(({ id }) => id === params.id)!, stage: 'INTERVIEW' })
  }))
  renderApp(applicants, true)
  await screen.findByRole('table', { name: '지원자 목록' })
  const firstMove = () => screen.getByRole('button', { name: `면접 집행 · ${first!.name} · ${first!.id}` })
  fireEvent.click(firstMove())
  const failure = await screen.findByText(/이전 상태로 복원했습니다/)
  expect(failure).toHaveTextContent(first!.id)
  const toaster = document.querySelector<HTMLElement>('[data-sonner-toaster]')!
  const liveRegion = toaster.closest('[aria-live]')!
  expect(document.querySelectorAll('[aria-live="polite"]')).toHaveLength(1)
  expect(failure.closest('[role="alert"]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: `면접 집행 · ${second!.name} · ${second!.id}` }))
  const success = await successToast()
  expect(success).toHaveTextContent(second!.name)
  await waitFor(() => expect(success).not.toBeInTheDocument(), { timeout: 5500 })
  expect(failure).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: `지원자 상세 보기: ${first!.name} · ${first!.id}` }))
  const dialog = screen.getByRole('dialog')
  expect(dialog).toContainElement(toaster)
  expect(toaster.closest('[aria-live]')).toBe(liveRegion)
  fireEvent.keyDown(within(dialog).getByRole('button', { name: /더 보기/ }), { key: 'Enter' })
  const reject = screen.getByRole('menuitem', { name: /불합격 처리/ })
  expect(dialog).toContainElement(reject)
  fireEvent.keyDown(reject, { key: 'Escape' })
  expect(screen.getByRole('dialog')).toBe(dialog)
  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  fireEvent.keyDown(within(dialog).getByRole('button', { name: /더 보기/ }), { key: 'Enter' })
  fireEvent.click(screen.getByRole('menuitem', { name: /불합격 처리/ }))
  const confirm = await screen.findByRole('dialog', { name: '단계 변경 확인' })
  expect(confirm).toContainElement(toaster)
  fireEvent.click(within(confirm).getByRole('button', { name: '취소' }))
  expect(dialog).toContainElement(toaster)
  fireEvent.click(within(dialog).getByRole('button', { name: '상세 패널 닫기' }))
  expect(document.body).toContainElement(toaster)
  expect(toaster.closest('dialog')).toBeNull()
  fireEvent.click(firstMove())
  const retried = await successToast()
  expect(retried).toHaveTextContent(first!.name)
  expect(screen.queryByText(/이전 상태로 복원했습니다/)).not.toBeInTheDocument()
  expect(document.querySelectorAll('[data-sonner-toast]')).toHaveLength(1)
  await waitFor(() => expect(retried).not.toBeInTheDocument(), { timeout: 5500 })
}, 15_000)
