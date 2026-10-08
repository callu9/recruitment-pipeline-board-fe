import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { toast } from 'sonner'
import App from './App'
import { saveApplicants, loadApplicants, POSITIONS_STORAGE_KEY } from './mocks/mockDb'
import { createSeedApplicants, SEED_POSITIONS } from './mocks/seedApplicants'
import { resetMockApiTestConfig, setMockApiTestConfig } from './mocks/mockConfig'
import { getLocalDateString } from './features/recruitment-board/model/stages'

if (!HTMLDialogElement.prototype.showModal) HTMLDialogElement.prototype.showModal = function () { this.open = true }
if (!HTMLDialogElement.prototype.close) HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')) }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); saveApplicants(createSeedApplicants(1, '2026-10-07')); localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(SEED_POSITIONS)); setMockApiTestConfig({ delayMs: 0, failureRate: 0 }) })
afterEach(() => { localStorage.clear(); sessionStorage.clear(); resetMockApiTestConfig(); toast.dismiss() })
const start = async () => { const result = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>); await screen.findByRole('table', { name: '지원자 목록' }); return result }
const openDetail = () => fireEvent.click(within(screen.getByRole('table', { name: '지원자 목록' })).getByRole('button', { name: /지원자 상세 보기:/ }))
const openForm = (name: string) => { const summary = screen.getByText(name, { selector: 'summary' }); summary.parentElement!.setAttribute('open', ''); return within(summary.parentElement!).getByRole('form', { name }) }
const change = (form: HTMLElement, label: string, value: string) => fireEvent.change(within(form).getByLabelText(label), { target: { value } })
const save = (form: HTMLElement, name: string) => fireEvent.click(within(form).getByRole('button', { name: `${name} 저장` }))

test('requires rationale for missing evaluation and persists the confirmed transition', async () => {
  await start(); fireEvent.click(screen.getByRole('button', { name: /^면접 집행/ }))
  const dialog = screen.getByRole('dialog', { name: '단계 변경 확인' })
  expect(loadApplicants()[0].stage).toBe('DOCUMENT_REVIEW')
  fireEvent.click(within(dialog).getByRole('button', { name: '확인' }))
  expect(within(dialog).getByRole('alert')).toHaveTextContent('진행 사유')
  change(dialog, '미완료 업무 확인 및 진행 사유', '내부 검토 완료, 면접에서 보완')
  fireEvent.click(within(dialog).getByRole('button', { name: '확인' }))
  await waitFor(() => expect(loadApplicants()[0].stage).toBe('INTERVIEW'))
  expect(loadApplicants()[0].timeline?.at(-1)).toMatchObject({ actor: '김하나', reason: '내부 검토 완료, 면접에서 보완' })
})
test('restores unsubmitted feedback when closing and reopening detail', async () => {
  await start(); openDetail()
  const form = screen.getByRole('form', { name: '서류검토 피드백' })
  change(form, '점수', '92'); change(form, '코멘트', '초안 유지')
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' })); openDetail()
  const reopened = screen.getByRole('form', { name: '서류검토 피드백' })
  expect(within(reopened).getByLabelText('점수')).toHaveValue(92)
  expect(within(reopened).getByLabelText('코멘트')).toHaveValue('초안 유지')
  expect(loadApplicants()[0].evaluations?.[0].status).toBe('PENDING')
})
test('keeps detail open when draft storage fails and discard is declined', async () => {
  await start(); openDetail()
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  try {
    change(screen.getByRole('form', { name: '서류검토 피드백' }), '코멘트', '보호할 입력')
    expect(screen.getByRole('alert')).toHaveTextContent('초안 저장 공간')
    fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' }))
    expect(confirm).toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('코멘트')).toHaveValue('보호할 입력')
  } finally { storage.mockRestore(); confirm.mockRestore() }
})
test('keeps a confirmed save successful when clearing the draft fails', async () => {
  await start(); openDetail()
  const form = screen.getByRole('form', { name: '서류검토 피드백' })
  change(form, '점수', '89'); change(form, '코멘트', '확정 저장')
  const cleanup = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
  try {
    fireEvent.click(within(form).getByRole('button', { name: '피드백 저장' }))
    await waitFor(() => expect(loadApplicants()[0].evaluations?.[0]).toMatchObject({ status: 'SUBMITTED', score: 89 }))
    await screen.findByText('확정 저장', { selector: 'p' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  } finally { cleanup.mockRestore() }
})
test('keeps schedule inputs on failure, retries and reloads saved schedule', async () => {
  const mounted = await start(); openDetail()
  let form = openForm('면접 일정 관리')
  change(form, '면접 날짜', '2026-12-01'); change(form, '면접관', '박민지')
  setMockApiTestConfig({ delayMs: 0, failureRate: 1 }); save(form, '면접 일정 관리')
  expect(await within(form).findByRole('alert')).toHaveTextContent('저장하지 못했습니다')
  expect(loadApplicants()[0].schedule).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' })); openDetail(); form = openForm('면접 일정 관리')
  expect(within(form).getByLabelText('면접 날짜')).toHaveValue('2026-12-01')
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 }); save(form, '면접 일정 관리')
  await within(form).findByRole('status')
  expect(loadApplicants()[0].schedule).toMatchObject({ date: '2026-12-01', interviewer: '박민지' })
  mounted.unmount(); await start() // URL selection restores the open detail after reload.
  expect(screen.getByRole('dialog')).toHaveTextContent('2026.12.01')
})
test('creates a real application through the intake form and exposes it in the query-backed table', async () => {
  await start(); const form = openForm('지원 접수')
  change(form, '지원자 이름', '새 지원자'); change(form, '지원자 이메일', 'intake@example.com'); change(form, '지원자 연락처', '010-1234'); change(form, '접수 경로', '추천'); change(form, '접수 포지션', 'position-frontend')
  save(form, '지원 접수'); await within(form).findByRole('status')
  expect(await screen.findByRole('button', { name: /지원자 상세 보기: 새 지원자/ })).toBeInTheDocument()
  expect(loadApplicants().find(({ name }) => name === '새 지원자')).toMatchObject({ source: '추천', positionId: 'position-frontend' })
})
test('navigates calendar beyond today plus seven days', async () => {
  const applicant = createSeedApplicants(2, '2026-10-07')[1]
  saveApplicants([{ ...applicant, schedule: { ...applicant.schedule!, date: '2026-12-01' } }])
  await start(); fireEvent.click(within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' })).getByRole('button', { name: /^캘린더/ }))
  fireEvent.change(screen.getByLabelText('표시 시작일'), { target: { value: '2026-12-01' } })
  expect(screen.getByRole('button', { name: /Alex Kim 인터뷰/ })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '다음 주' })); expect(screen.getByLabelText('표시 시작일')).toHaveValue('2026-12-08')
  fireEvent.click(screen.getByRole('button', { name: '이전 주' })); expect(screen.getByLabelText('표시 시작일')).toHaveValue('2026-12-01')
})
test('excludes paused applications from workspace active counts', async () => {
  saveApplicants([{ ...loadApplicants()[0], lifecycle: 'ON_HOLD', lifecycleReason: '검토 보류' }])
  await start(); openDetail()
  expect(within(openForm('지원 상태 관리')).getByLabelText('지원 상태')).toHaveValue('ON_HOLD')
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' }))
  fireEvent.click(within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' })).getByRole('button', { name: /^오늘 할 일/ }))
  expect(screen.getByRole('region', { name: '요약 지표' })).toHaveTextContent('진행 중0')
})
test('shows timestamp-based application dates as KST local dates in list and detail', async () => {
  vi.stubEnv('TZ', 'Asia/Seoul')
  try {
    saveApplicants([{ ...loadApplicants()[0], appliedAt: '2026-10-07T15:30:00Z' }])
    await start()
    expect(screen.getByRole('table', { name: '지원자 목록' })).toHaveTextContent('지원 2026.10.08')
    openDetail()
    expect(screen.getByRole('dialog').querySelector('dl')).toHaveTextContent('지원일2026.10.08')
  } finally { vi.unstubAllEnvs() }
})
test('offers executable Today queues for due responses and starts and removes completed work', async () => {
  const today = getLocalDateString()
  const base = { ...loadApplicants()[0], dueDate: undefined, evaluations: [], schedule: null, followUps: [] }
  const offer = { conditions: '조건', proposedAt: today, responseDueDate: today, status: 'SENT' as const, reason: '' }
  saveApplicants([{ ...base, stage: 'OFFER', offer }, { ...base, id: 'start-check', name: '입사 확인 지원자', stage: 'HIRED', offer: { ...offer, status: 'ACCEPTED' }, employment: { plannedStartDate: today, actualStartDate: '' } }])
  await start(); const nav = within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' }))
  fireEvent.click(nav.getByRole('button', { name: /^오늘 할 일/ }))
  expect(nav.getByRole('button', { name: /^오늘 할 일/ })).toHaveTextContent('2')
  let queue = screen.getByRole('heading', { name: '오퍼 응답 확인' }).closest('section')!
  expect(queue).toHaveTextContent(today.replaceAll('-', '.'))
  fireEvent.click(within(queue).getByRole('button', { name: /^지원자 상세 보기:/ }))
  const offerForm = openForm('오퍼 관리'); change(offerForm, '오퍼 상태', 'ACCEPTED'); save(offerForm, '오퍼 관리')
  await within(offerForm).findByRole('status')
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' }))
  expect(screen.getByRole('heading', { name: '오퍼 응답 확인' }).closest('section')).toHaveTextContent('현재 항목이 없습니다.')
  queue = screen.getByRole('heading', { name: '입사 확인' }).closest('section')!
  fireEvent.click(within(queue).getByRole('button', { name: /^지원자 상세 보기:/ }))
  const startForm = openForm('입사 관리'); change(startForm, '실제 입사일', today); save(startForm, '입사 관리')
  await within(startForm).findByRole('status')
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' }))
  expect(screen.getByRole('heading', { name: '입사 확인' }).closest('section')).toHaveTextContent('현재 항목이 없습니다.')
  expect(nav.getByRole('button', { name: /^오늘 할 일/ })).toHaveTextContent('0')
})
test('surfaces the shared API guard when withdrawing an actually employed applicant', async () => {
  const today = getLocalDateString()
  saveApplicants([{ ...loadApplicants()[0], stage: 'HIRED', offer: { conditions: '조건', proposedAt: today, responseDueDate: today, status: 'ACCEPTED', reason: '' }, employment: { plannedStartDate: today, actualStartDate: today } }])
  await start(); openDetail(); const form = openForm('지원 상태 관리')
  change(form, '지원 상태', 'WITHDRAWN'); change(form, '상태 변경 사유', '철회 요청'); save(form, '지원 상태 관리')
  expect(await within(form).findByRole('alert')).toHaveTextContent('실제 입사')
  expect(loadApplicants()[0].lifecycle).not.toBe('WITHDRAWN')
  expect(loadApplicants()[0].employment?.actualStartDate).toBe(today)
  fireEvent.click(screen.getByRole('button', { name: '단계 정정' }))
  expect(screen.queryByRole('dialog', { name: '단계 정정 확인' })).not.toBeInTheDocument()
  expect(await screen.findByText('실제 입사 후에는 전형 단계를 변경할 수 없습니다.')).toBeInTheDocument()
})

test.each([false, true])('returns resumed evaluation to Today through hold=%s and clears progress warning after submission', async (viaHold) => {
  await start(); openDetail()
  const lifecycle = async (status: string) => {
    const form = openForm('지원 상태 관리')
    change(form, '지원 상태', status); change(form, '상태 변경 사유', '재개 회귀 검증'); save(form, '지원 상태 관리')
    await waitFor(() => expect(loadApplicants()[0].lifecycle).toBe(status))
  }
  await lifecycle('WITHDRAWN')
  if (viaHold) await lifecycle('ON_HOLD')
  await lifecycle('ACTIVE')
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' }))
  const nav = within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' }))
  fireEvent.click(nav.getByRole('button', { name: /^오늘 할 일/ }))
  const queue = screen.getByRole('heading', { name: '평가 작성 필요' }).closest('section')!
  fireEvent.click(within(queue).getByRole('button', { name: /^지원자 상세 보기:/ }))
  const plan = openForm('평가 계획·재평가')
  change(plan, '계획 평가자', '박민지'); change(plan, '평가 기한', '2026-10-09'); change(plan, '평가 계획 사유', '재배정'); save(plan, '평가 계획·재평가')
  await waitFor(() => expect(loadApplicants()[0].evaluations![0]).toMatchObject({ active: true, reviewer: '박민지', dueDate: '2026-10-09' }))
  const feedbackForm = screen.getByRole('form', { name: '서류검토 피드백' })
  change(feedbackForm, '점수', '85'); change(feedbackForm, '코멘트', '재개 후 평가 완료')
  fireEvent.click(within(feedbackForm).getByRole('button', { name: '피드백 저장' }))
  await waitFor(() => expect(loadApplicants()[0].evaluations![0].status).toBe('SUBMITTED'))
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' }))
  expect(screen.getByRole('heading', { name: '평가 작성 필요' }).closest('section')).toHaveTextContent('현재 항목이 없습니다.')
  fireEvent.click(nav.getByRole('button', { name: /^지원자/ }))
  fireEvent.click(screen.getByRole('button', { name: /^면접 집행/ }))
  expect(screen.queryByRole('dialog', { name: '단계 변경 확인' })).not.toBeInTheDocument()
  await waitFor(() => expect(loadApplicants()[0].stage).toBe('INTERVIEW'))
})


test('includes active talent pool records in archive count and listing', async () => {
  const applicant = createSeedApplicants(1)[0]
  saveApplicants([{ ...applicant, talentPool: true }])
  await start()
  const archive = screen.getByRole('button', { name: /^보관·인재풀/ })
  expect(archive).toHaveTextContent('1')
  fireEvent.click(archive)
  expect(within(screen.getByRole('table', { name: '지원자 목록' })).getByText(applicant.name)).toBeInTheDocument()
})

test('clears only the appended note after save and avoids a duplicate on repeat save', async () => {
  await start(); openDetail()
  const form = openForm('담당 업무 편집')
  change(form, '새 메모', '한 번만 기록할 메모')
  change(form, '다음 행동', '유지할 업무')
  save(form, '담당 업무 편집')
  await within(form).findByText('저장했습니다.')
  expect(within(form).getByLabelText('새 메모')).toHaveValue('')
  expect(within(form).getByLabelText('다음 행동')).toHaveValue('유지할 업무')
  save(form, '담당 업무 편집')
  await within(form).findByText('저장했습니다.')
  expect(loadApplicants()[0].notes?.filter(({ text }) => text === '한 번만 기록할 메모')).toHaveLength(1)
})

test('applies calendar role owner and type filters to unscheduled interviews', async () => {
  const seeds = createSeedApplicants(2)
  saveApplicants(seeds.map((applicant, i) => ({ ...applicant, stage: 'INTERVIEW', schedule: null, role: i ? 'Data Analyst' : 'Frontend Developer', owner: i ? '박민지' : '김하나' })))
  await start()
  fireEvent.click(screen.getByRole('button', { name: /^캘린더/ }))
  fireEvent.change(screen.getByLabelText('캘린더 직무 필터'), { target: { value: 'Frontend Developer' } })
  expect(screen.getAllByRole('button', { name: /^일정 미정 상세 보기:/ })).toHaveLength(1)
  fireEvent.change(screen.getByLabelText('캘린더 담당자 필터'), { target: { value: '박민지' } })
  expect(screen.queryByRole('button', { name: /^일정 미정 상세 보기:/ })).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('캘린더 담당자 필터'), { target: { value: 'ALL' } })
  fireEvent.change(screen.getByLabelText('이벤트 유형 필터'), { target: { value: 'OFFER' } })
  expect(screen.queryByRole('button', { name: /^일정 미정 상세 보기:/ })).not.toBeInTheDocument()
})

test('shows inactive interviews as history rather than the current row schedule', async () => {
  const applicant = createSeedApplicants(2)[1]
  saveApplicants([{ ...applicant, stage: 'OFFER', schedule: { ...applicant.schedule!, active: false } }])
  await start()
  const row = within(screen.getByRole('table', { name: '지원자 목록' })).getAllByRole('row')[1]
  expect(within(row).getAllByRole('cell')[4]).toHaveTextContent('미정')
  openDetail()
  expect(screen.getByText('이전 면접 일정')).toBeInTheDocument()
})

test('restores URL filters and selection on initial load', async () => {
  window.history.replaceState(null, '', '?view=applicants&name=김민지&applicant=applicant-001')
  await start()
  expect(screen.getByLabelText('이름 검색')).toHaveValue('김민지')
  expect(screen.getByRole('dialog', { name: '김민지' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' }))
  expect(new URLSearchParams(window.location.search).has('applicant')).toBe(false)
})

test('restores tabs and filters from popstate without persisting applicant changes', async () => {
  await start()
  fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: '김민지' } })
  const listUrl = window.location.href
  const before = loadApplicants()
  expect(new URL(listUrl).searchParams.get('name')).toBe('김민지')
  fireEvent.click(screen.getByRole('button', { name: /^오늘 할 일/ }))
  expect(new URLSearchParams(window.location.search).get('view')).toBe('today')
  window.history.replaceState(null, '', listUrl)
  fireEvent(window, new PopStateEvent('popstate'))
  expect(await screen.findByRole('table', { name: '지원자 목록' })).toBeInTheDocument()
  expect(screen.getByLabelText('이름 검색')).toHaveValue('김민지')
  expect(loadApplicants()).toEqual(before)
})


test('restores applicant trigger focus when browser back closes detail', async () => {
  await start()
  const listUrl = window.location.href
  const trigger = screen.getByRole('button', { name: /^지원자 상세 보기:/ })
  trigger.focus(); fireEvent.click(trigger)
  window.history.replaceState(null, '', listUrl)
  fireEvent(window, new PopStateEvent('popstate'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(document.activeElement).toBe(trigger)
})


test('waits for query data before clamping a page restored from URL', async () => {
  saveApplicants(createSeedApplicants(45))
  window.history.replaceState(null, '', '?page=2&size=20')
  await start()
  expect(screen.getByRole('status', { name: '지원자 페이지 상태' })).toHaveTextContent('2 / 3 페이지')
  expect(new URLSearchParams(window.location.search).get('page')).toBe('2')
})


test('cancels a stage confirmation when back closes its applicant detail', async () => {
  await start()
  const listUrl = window.location.href
  openDetail()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^면접 집행/ }))
  expect(screen.getByRole('dialog', { name: '단계 변경 확인' })).toBeInTheDocument()
  const before = loadApplicants()
  window.history.replaceState(null, '', listUrl)
  fireEvent(window, new PopStateEvent('popstate'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(loadApplicants()).toEqual(before)
})

test('keeps the previous history entry after declining back with an unsaved draft error', async () => {
  window.history.replaceState(null, '', '?e2eHistory=anchor')
  await start(); openDetail()
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  try {
    change(screen.getByRole('form', { name: '서류검토 피드백' }), '코멘트', '보호할 초안')
    window.history.back()
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(new URLSearchParams(window.location.search).get('applicant')).toBe('applicant-001')
    confirm.mockReturnValue(true)
    window.history.back()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(new URLSearchParams(window.location.search).get('e2eHistory')).toBe('anchor')
    expect(loadApplicants()[0].evaluations?.[0].status).toBe('PENDING')
  } finally { storage.mockRestore(); confirm.mockRestore() }
})
