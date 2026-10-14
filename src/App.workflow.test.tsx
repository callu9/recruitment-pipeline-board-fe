if (!HTMLDialogElement.prototype.show) HTMLDialogElement.prototype.show = function () { this.open = true }
import { http, HttpResponse } from 'msw'
import { server } from './test/server'
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
const openForm = (name: string) => { if (name === '지원 접수' || name === '지원 일괄 가져오기') { if (!screen.queryByRole('dialog', { name: '지원 접수 및 가져오기' })) fireEvent.click(screen.getByRole('button', { name: '지원 접수' })) } else if (['포지션 배정 변경', '지원 정보 편집', '지원 상태 관리', '보관·복원', '지원 건 삭제'].includes(name)) fireEvent.click(screen.getByRole('tab', { name: '지원 정보' })); else if (screen.queryByRole('tab', { name: '업무' })) fireEvent.click(screen.getByRole('tab', { name: '업무' })); const summary = screen.getByText(name, { selector: 'summary' }); summary.parentElement!.setAttribute('open', ''); return within(summary.parentElement!).getByRole('form', { name }) }
const change = (form: HTMLElement, label: string, value: string) => fireEvent.change(within(form).getByLabelText(label), { target: { value } })
const save = (form: HTMLElement, name: string) => fireEvent.click(within(form).getByRole('button', { name: `${name} 저장` }))

test('requires rationale for missing evaluation and persists the confirmed transition', async () => {
  await start(); fireEvent.click(screen.getByRole('button', { name: /^면접 집행/ }))
  const dialog = screen.getByRole('dialog', { name: '단계 변경 확인' })
  expect(within(dialog).getByLabelText('미완료 업무 확인 및 진행 사유').closest('form')).not.toBeNull()
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
    fireEvent.click(screen.getByRole('tab', { name: '지원 정보' }))
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

test('distinguishes an empty archive from a filtered archive', async () => {
  await start()
  fireEvent.click(screen.getByRole('button', { name: /^보관·인재풀/ }))
  expect(screen.getByRole('heading', { name: '아직 보관된 지원자가 없습니다.' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '필터 초기화' })).not.toBeInTheDocument()
})

test('shows a filter recovery action when archived records exist', async () => {
  const applicant = loadApplicants()[0]
  saveApplicants([applicant, { ...applicant, id: 'archived-test', stage: 'REJECTED', archivedAt: '2026-10-07' }])
  await start()
  fireEvent.click(screen.getByRole('button', { name: /^보관·인재풀/ }))
  fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: '존재하지 않는 이름' } })
  expect(screen.getByRole('heading', { name: '조건에 맞는 지원자가 없습니다.' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '필터 초기화' }))
  expect(screen.getByRole('table', { name: '지원자 목록' })).toHaveTextContent(applicant.name)
})

test('uses domain labels in evaluation records and planning options', async () => {
  await start(); openDetail()
  expect(screen.getByRole('dialog')).not.toHaveTextContent('SCREEN')
  const form = openForm('평가 계획·재평가')
  expect(within(form).getByLabelText('대상 평가')).toHaveTextContent('서류검토 · 1회차 · 작성 필요')
  expect(within(form).getByLabelText('대상 평가')).not.toHaveTextContent('PENDING')
})

test('shows due urgency only for active applicants', async () => {
  const today = getLocalDateString()
  const applicant = loadApplicants()[0]
  saveApplicants([{ ...applicant, dueDate: today, evaluations: [] }])
  await start()
  expect(screen.getByRole('table', { name: '지원자 목록' })).toHaveTextContent('오늘 마감')
})

test('opens the incomplete work directly and keeps the desktop list available', async () => {
  saveApplicants([{ ...loadApplicants()[0], stage: 'INTERVIEW', schedule: null }])
  await start()
  fireEvent.click(screen.getByRole('button', { name: /^면접 일정 등록 ·/ }))
  const detail = screen.getByRole('dialog', { name: '김민지' })
  expect(detail).not.toHaveAttribute('aria-modal', 'true')
  expect(screen.getByRole('table', { name: '지원자 목록' })).toBeInTheDocument()
  expect(screen.getByLabelText('면접 날짜')).toHaveFocus()
  expect(within(detail).queryByRole('button', { name: '단계 정정' })).not.toBeInTheDocument()
  expect(within(detail).getByRole('button', { name: /^처우 협의/ })).toBeInTheDocument()
})
test('keeps feedback draft while switching to support and back', async () => {
  await start(); openDetail()
  change(screen.getByRole('form', { name: '서류검토 피드백' }), '코멘트', '탭 이동 초안')
  fireEvent.click(screen.getByRole('tab', { name: '지원 정보' }))
  expect(screen.getByRole('button', { name: '단계 정정' })).toBeInTheDocument()
  expect(screen.queryByRole('form', { name: '서류검토 피드백' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: '업무' }))
  expect(screen.getByLabelText('코멘트')).toHaveValue('탭 이동 초안')
})
test('opens intake beside the title and restores trigger focus and unsaved input', async () => {
  await start()
  expect(screen.queryByRole('region', { name: '지원 접수 관리' })).not.toBeInTheDocument()
  const trigger = screen.getByRole('button', { name: '지원 접수' }); trigger.focus(); fireEvent.click(trigger)
  const dialog = screen.getByRole('dialog', { name: '지원 접수 및 가져오기' })
  const form = openForm('지원 접수'); change(form, '지원자 이름', '접수 초안')
  fireEvent.keyDown(dialog, { key: 'Escape' })
  await waitFor(() => expect(trigger).toHaveFocus())
  fireEvent.click(trigger)
  expect(within(openForm('지원 접수')).getByLabelText('지원자 이름')).toHaveValue('접수 초안')
})
test('prevents switching applicant when a draft cannot be stored', async () => {
  saveApplicants(createSeedApplicants(2, '2026-10-07')); await start()
  fireEvent.click(screen.getByRole('button', { name: /지원자 상세 보기: 김민지/ }))
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  try {
    change(screen.getByRole('form', { name: '서류검토 피드백' }), '코멘트', '유실 금지')
    fireEvent.click(screen.getByRole('button', { name: /지원자 상세 보기: Alex Kim/ }))
    expect(confirm).toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: '김민지' })).toBeInTheDocument()
    expect(screen.getByLabelText('코멘트')).toHaveValue('유실 금지')
  } finally { storage.mockRestore(); confirm.mockRestore() }
})

test('keeps the toaster in the live detail after clicking the same work again', async () => {
  await start()
  const trigger = screen.getByRole('button', { name: /^평가 작성 ·/ })
  fireEvent.click(trigger)
  const feedback = screen.getByRole('form', { name: '서류검토 피드백' })
  change(feedback, '점수', '86'); change(feedback, '코멘트', '알림 유지 검증')
  fireEvent.click(within(feedback).getByRole('button', { name: '피드백 저장' }))
  await screen.findByText('김민지님의 피드백을 저장했습니다.')
  const host = document.querySelector('[data-sonner-toaster]')
  expect(host).not.toBeNull()
  fireEvent.click(trigger)
  expect(screen.getByRole('dialog', { name: '김민지' })).toContainElement(host as HTMLElement)
  expect(host?.isConnected).toBe(true)
})
test('focuses the current pending evaluation when a historical pending form precedes it', async () => {
  const base = loadApplicants()[0]
  saveApplicants([{ ...base, evaluations: [{ ...base.evaluations![0], id: 'old', active: false }, { ...base.evaluations![0], id: 'current', active: true }] }])
  await start(); fireEvent.click(screen.getByRole('button', { name: /^평가 작성 ·/ }))
  const forms = screen.getAllByRole('form', { name: '서류검토 피드백' })
  expect(forms[1]).toContainElement(document.activeElement as HTMLElement)
})

test('preserves intake pending guard across closing and reopening the modal', async () => {
  await start(); let form = openForm('지원 접수')
  change(form, '지원자 이름', '재지원'); change(form, '지원자 이메일', 'applicant1@example.com'); change(form, '지원자 연락처', '010-0000'); change(form, '접수 경로', '추천'); change(form, '접수 포지션', 'position-frontend'); change(form, '동일인·재지원 연결', 'applicant-001')
  const original = globalThis.fetch
  let release: ((response: Response) => void) | undefined; let posts = 0
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    if (String(input) === '/api/applicants' && init?.method === 'POST') { posts++; return new Promise<Response>((resolve) => { release = resolve }) }
    return original(input, init)
  })
  try {
    save(form, '지원 접수'); await waitFor(() => expect(posts).toBe(1))
    fireEvent.click(screen.getByRole('button', { name: '접수 창 닫기' }))
    form = openForm('지원 접수')
    expect(within(form).getByRole('button', { name: '저장 중' })).toBeDisabled()
    fireEvent.submit(form)
    expect(posts).toBe(1)
  } finally { release?.(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })); fetch.mockRestore() }
})

test('PR review R2: feedback form follows a reviewer reassigned by the evaluation plan', async () => {
  await start(); openDetail()
  const plan = screen.getByRole('form', { name: '평가 계획·재평가' })
  change(plan, '계획 평가자', '박민지'); change(plan, '평가 기한', '2026-10-20'); change(plan, '평가 계획 사유', '담당 변경')
  save(plan, '평가 계획·재평가')
  await waitFor(() => expect(loadApplicants()[0].evaluations?.find(({ type }) => type === 'SCREEN')?.reviewer).toBe('박민지'), { timeout: 4000 })
  await waitFor(() => expect(within(screen.getByRole('form', { name: '서류검토 피드백' })).getByLabelText('평가자')).toHaveValue('박민지'))
})
test('PR review R2: leaving positions asks before discarding a position draft that could not be stored', async () => {
  await start()
  fireEvent.click(within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' })).getByRole('button', { name: /^포지션/ }))
  const form = await screen.findByRole('form', { name: '포지션 개설·수정' })
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  try {
    change(form, '포지션명', '유실 금지')
    fireEvent.click(within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' })).getByRole('button', { name: /^지원자/ }))
    expect(confirm).toHaveBeenCalled()
    expect(within(screen.getByRole('form', { name: '포지션 개설·수정' })).getByLabelText('포지션명')).toHaveValue('유실 금지')
  } finally { storage.mockRestore(); confirm.mockRestore() }
})
test('PR review R2: visiting an empty archive does not reset the applicants page', async () => {
  saveApplicants(createSeedApplicants(45))
  window.history.replaceState(null, '', '?page=2&size=20')
  await start()
  const nav = within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' }))
  fireEvent.click(nav.getByRole('button', { name: /^보관·인재풀/ }))
  fireEvent.click(nav.getByRole('button', { name: /^지원자/ }))
  expect(await screen.findByRole('status', { name: '지원자 페이지 상태' })).toHaveTextContent('2 / 3 페이지')
})
test('PR review R3: a reopened feedback draft does not restore a reviewer replaced by the evaluation plan', async () => {
  await start(); openDetail()
  change(screen.getByRole('form', { name: '서류검토 피드백' }), '점수', '77')
  const plan = screen.getByRole('form', { name: '평가 계획·재평가' })
  change(plan, '계획 평가자', '박민지'); change(plan, '평가 기한', '2026-10-20'); change(plan, '평가 계획 사유', '담당 변경')
  save(plan, '평가 계획·재평가')
  await waitFor(() => expect(within(screen.getByRole('form', { name: '서류검토 피드백' })).getByLabelText('평가자')).toHaveValue('박민지'), { timeout: 4000 })
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' })); openDetail()
  const reopened = screen.getByRole('form', { name: '서류검토 피드백' })
  expect(within(reopened).getByLabelText('평가자')).toHaveValue('박민지')
  expect(within(reopened).getByLabelText('점수')).toHaveValue(77)
})
test('PR review R3: a late delete response closes only the deleted applicant detail', async () => {
  const [a, b, c] = createSeedApplicants(3, '2026-10-07')
  saveApplicants([{ ...a!, stage: 'REJECTED', archivedAt: '2026-10-07T00:00:00.000Z', followUps: [] }, { ...b!, stage: 'REJECTED', archivedAt: '2026-10-07T00:00:00.000Z', followUps: [] }, c!])
  await start()
  fireEvent.click(within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' })).getByRole('button', { name: /^보관·인재풀/ }))
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`지원자 상세 보기: ${a!.name}`) }))
  fireEvent.click(within(screen.getByRole('dialog', { name: a!.name })).getByRole('tab', { name: '지원 정보' }))
  const form = screen.getByRole('form', { name: '지원 건 삭제' })
  change(form, '삭제할 지원 건 ID 확인', a!.id); change(form, '삭제 사유', '보존 기한 만료')
  setMockApiTestConfig({ delayMs: 400, failureRate: 0 })
  save(form, '지원 건 삭제')
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`지원자 상세 보기: ${b!.name}`) }))
  await waitFor(() => expect(loadApplicants().some(({ id }) => id === a!.id)).toBe(false), { timeout: 4000 })
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(screen.getByRole('dialog', { name: b!.name })).toBeInTheDocument()
})
test('PR review R4: a pending position save stays locked after leaving and returning to positions', async () => {
  await start()
  const nav = within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' }))
  fireEvent.click(nav.getByRole('button', { name: /^포지션/ }))
  const form = await screen.findByRole('form', { name: '포지션 개설·수정' })
  change(form, '포지션명', '새 포지션'); change(form, '부서', '플랫폼')
  setMockApiTestConfig({ delayMs: 400, failureRate: 0 })
  save(form, '포지션 개설·수정')
  fireEvent.click(nav.getByRole('button', { name: /^지원자/ }))
  fireEvent.click(nav.getByRole('button', { name: /^포지션/ }))
  expect(within(screen.getByRole('form', { name: '포지션 개설·수정' })).getByRole('button', { name: '저장 중' })).toBeDisabled()
})
test('Form sync D2: a late contact save for one applicant does not disturb the contact form of another', async () => {
  const [a, b] = createSeedApplicants(2, '2026-10-07')
  const contact = (id: string, date: string) => ({ id, channel: '전화', content: '안내', date, status: 'PLANNED' as const, reply: '', actor: '김하나' as const })
  saveApplicants([{ ...a!, contacts: [contact(`contact-${a!.id}-1`, '2026-10-10')] }, { ...b!, contacts: [contact(`contact-${b!.id}-1`, '2026-10-20')] }])
  await start()
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`지원자 상세 보기: ${a!.name}`) }))
  let form = openForm('연락 기록')
  change(form, '편집할 연락', `contact-${a!.id}-1`); change(form, '응답', 'A 회신')
  setMockApiTestConfig({ delayMs: 300, failureRate: 0 })
  save(form, '연락 기록')
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`지원자 상세 보기: ${b!.name}`) }))
  form = openForm('연락 기록')
  change(form, '편집할 연락', `contact-${b!.id}-1`)
  await waitFor(() => expect(loadApplicants().find(({ id }) => id === a!.id)?.contacts?.[0]?.reply).toBe('A 회신'), { timeout: 4000 })
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  change(form, '응답', 'B 회신'); save(form, '연락 기록')
  await waitFor(() => expect(loadApplicants().find(({ id }) => id === b!.id)?.contacts?.[0]?.reply).toBe('B 회신'), { timeout: 4000 })
})
test('Form sync D3: saving a new contact twice from the same form edits the created contact', async () => {
  await start(); openDetail()
  const form = openForm('연락 기록')
  change(form, '연락 채널', '전화'); change(form, '연락 날짜', '2026-10-10'); change(form, '연락 내용', '면접 안내')
  save(form, '연락 기록')
  await waitFor(() => expect(loadApplicants()[0].contacts).toHaveLength(1), { timeout: 4000 })
  await waitFor(() => expect(within(form).getByRole('status')).toHaveTextContent('저장했습니다'))
  change(form, '실행 여부', 'DONE'); change(form, '응답', '확인')
  save(form, '연락 기록')
  await waitFor(() => expect(loadApplicants()[0].contacts?.[0]).toMatchObject({ status: 'DONE', reply: '확인' }), { timeout: 4000 })
  expect(loadApplicants()[0].contacts).toHaveLength(1)
})
test('Form sync R2: completing a contact-linked task that disappears returns the follow-up form to a new task', async () => {
  await start(); openDetail()
  const contactForm = openForm('연락 기록')
  change(contactForm, '연락 채널', '전화'); change(contactForm, '연락 날짜', '2026-10-10'); change(contactForm, '연락 내용', '면접 안내')
  save(contactForm, '연락 기록')
  await waitFor(() => expect(loadApplicants()[0].followUps?.some(({ id }) => id.startsWith('contact-'))).toBe(true), { timeout: 4000 })
  const taskForm = openForm('후속 업무 관리')
  const contactTask = loadApplicants()[0].followUps!.find(({ id }) => id.startsWith('contact-'))!
  await waitFor(() => expect(within(taskForm).getByRole('option', { name: /면접 안내/ })).toBeInTheDocument())
  change(taskForm, '편집할 업무', contactTask.id); change(taskForm, '완료 상태', 'true')
  save(taskForm, '후속 업무 관리')
  await waitFor(() => expect(loadApplicants()[0].contacts?.[0]?.status).toBe('DONE'), { timeout: 4000 })
  await waitFor(() => expect(within(taskForm).getByLabelText('편집할 업무')).toHaveValue(''))
  change(taskForm, '후속 업무', '서류 보완 요청'); change(taskForm, '후속 업무 기한', '2026-10-21'); change(taskForm, '완료 상태', 'false')
  save(taskForm, '후속 업무 관리')
  await waitFor(() => expect(loadApplicants()[0].followUps?.some(({ label }) => label === '서류 보완 요청')).toBe(true), { timeout: 4000 })
})
test('Form sync R4: a memo saved while the detail was reopened is cleared from the reopened form', async () => {
  await start(); openDetail()
  const form = openForm('담당 업무 편집')
  change(form, '새 메모', '메모 A')
  setMockApiTestConfig({ delayMs: 300, failureRate: 0 })
  save(form, '담당 업무 편집')
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' })); openDetail()
  const reopened = openForm('담당 업무 편집')
  await waitFor(() => expect(loadApplicants()[0].notes?.filter(({ text }) => text === '메모 A')).toHaveLength(1), { timeout: 4000 })
  await waitFor(() => expect(within(reopened).getByLabelText('새 메모')).toHaveValue(''))
})
test('Form sync R5: a memo saved after a stage change does not restore the previous stage work', async () => {
  await start(); openDetail()
  let form = openForm('담당 업무 편집')
  change(form, '업무 기한', '2026-10-30'); change(form, '다음 행동', '서류 보완')
  save(form, '담당 업무 편집')
  await waitFor(() => expect(loadApplicants()[0]).toMatchObject({ dueDate: '2026-10-30', nextAction: '서류 보완' }), { timeout: 4000 })
  fireEvent.click(within(screen.getByRole('dialog', { name: '김민지' })).getByRole('button', { name: /^면접 집행/ }))
  const dialog = screen.getByRole('dialog', { name: '단계 변경 확인' })
  change(dialog, '미완료 업무 확인 및 진행 사유', '면접에서 확인')
  fireEvent.click(within(dialog).getByRole('button', { name: '확인' }))
  await waitFor(() => expect(loadApplicants()[0].stage).toBe('INTERVIEW'), { timeout: 4000 })
  const stored = loadApplicants()[0]
  form = openForm('담당 업무 편집')
  change(form, '새 메모', '면접 준비 메모')
  save(form, '담당 업무 편집')
  await waitFor(() => expect(loadApplicants()[0].notes?.some(({ text }) => text === '면접 준비 메모')).toBe(true), { timeout: 4000 })
  // An empty due date is the work form's way of saying 'none'.
  expect(loadApplicants()[0].dueDate || undefined).toBe(stored.dueDate)
  expect(loadApplicants()[0].nextAction).toBe(stored.nextAction)
})
test('Form sync R6: a reopened memo draft does not restore work fields changed by a stage move', async () => {
  await start(); openDetail()
  let form = openForm('담당 업무 편집')
  change(form, '업무 기한', '2026-10-30'); change(form, '다음 행동', '서류 보완')
  save(form, '담당 업무 편집')
  await waitFor(() => expect(loadApplicants()[0]).toMatchObject({ dueDate: '2026-10-30', nextAction: '서류 보완' }), { timeout: 4000 })
  change(form, '새 메모', '메모 초안')
  fireEvent.click(screen.getByRole('button', { name: '상세 패널 닫기' }))
  fireEvent.click(within(screen.getByRole('table', { name: '지원자 목록' })).getByRole('button', { name: /^면접 집행/ }))
  const dialog = screen.getByRole('dialog', { name: '단계 변경 확인' })
  change(dialog, '미완료 업무 확인 및 진행 사유', '면접에서 확인')
  fireEvent.click(within(dialog).getByRole('button', { name: '확인' }))
  await waitFor(() => expect(loadApplicants()[0].stage).toBe('INTERVIEW'), { timeout: 4000 })
  const stored = loadApplicants()[0]
  openDetail(); form = openForm('담당 업무 편집')
  expect(within(form).getByLabelText('새 메모')).toHaveValue('메모 초안')
  expect(within(form).getByLabelText('다음 행동')).toHaveValue(stored.nextAction)
  expect(within(form).getByLabelText('업무 기한')).toHaveValue(stored.dueDate ?? '')
})
test('Form sync R9: each Today queue opens the work of that queue', async () => {
  const today = getLocalDateString()
  const base = createSeedApplicants(1, '2026-10-07')[0]!
  saveApplicants([{ ...base, stage: 'INTERVIEW', schedule: { date: today, startTime: '10:00', endTime: '11:00', format: 'VIDEO', interviewer: '김하나', status: 'CONFIRMED', round: 1, active: true }, evaluations: [{ id: 'interview-1', type: 'INTERVIEW', status: 'PENDING', dueDate: today, reviewer: '김하나', round: 1, active: true }] }])
  await start()
  fireEvent.click(within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' })).getByRole('button', { name: /^오늘 할 일/ }))
  const section = (title: string) => screen.getByRole('heading', { name: title }).closest('section')!
  expect(within(section('오늘의 인터뷰')).getByRole('button', { name: /^상세 보기:/ })).toHaveTextContent('면접 일정 확인')
  expect(within(section('평가 작성 필요')).getByRole('button', { name: /^상세 보기:/ })).toHaveTextContent('평가 작성')
})
test('Form sync R10: the Today evaluation shortcut focuses the pending evaluation even when another task sets the overall due date', async () => {
  const today = getLocalDateString()
  const base = createSeedApplicants(1, '2026-10-07')[0]!
  const screen0 = base.evaluations!.find(({ type }) => type === 'SCREEN')!
  saveApplicants([{ ...base, evaluations: [{ ...screen0, status: 'PENDING', dueDate: today, active: true }], followUps: [{ id: 'task-1', label: '서류 보완 요청', dueDate: '2026-10-01', done: false }] }])
  await start()
  fireEvent.click(within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' })).getByRole('button', { name: /^오늘 할 일/ }))
  const section = screen.getByRole('heading', { name: '평가 작성 필요' }).closest('section')!
  fireEvent.click(within(section).getByRole('button', { name: /^상세 보기:/ }))
  await waitFor(() => expect(document.activeElement?.closest('[data-work-target="evaluation"]')).not.toBeNull())
})
test('Form sync R11: feedback waits for position criteria when the position list failed to load', async () => {
  server.use(http.get('*/api/positions', () => HttpResponse.json({ message: 'fail' }, { status: 503 })))
  await start(); openDetail()
  const form = screen.getByRole('form', { name: '서류검토 피드백' })
  expect(within(form).getByRole('alert')).toHaveTextContent('포지션 평가 기준을 확인하지 못했습니다')
  expect(within(form).getByRole('button', { name: '피드백 저장' })).toBeDisabled()
})
test('Form sync R11: the evaluation queue shows the pending evaluation due date', async () => {
  const today = getLocalDateString()
  const base = createSeedApplicants(1, '2026-10-07')[0]!
  const screen0 = base.evaluations!.find(({ type }) => type === 'SCREEN')!
  saveApplicants([{ ...base, evaluations: [{ ...screen0, status: 'PENDING', dueDate: today, active: true }], followUps: [{ id: 'task-1', label: '서류 보완 요청', dueDate: '2026-10-01', done: false }] }])
  await start()
  fireEvent.click(within(screen.getByRole('navigation', { name: '워크스페이스 메뉴' })).getByRole('button', { name: /^오늘 할 일/ }))
  const section = screen.getByRole('heading', { name: '평가 작성 필요' }).closest('section')!
  expect(section).not.toHaveTextContent('2026.10.01')
  expect(section).toHaveTextContent(today.replaceAll('-', '.'))
})
