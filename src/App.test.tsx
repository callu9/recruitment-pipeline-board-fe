import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, expect, test } from 'vitest'
import App from './App'
import styles from './App.module.css'
import type { Applicant } from './features/recruitment-board/model/applicant.types'
import { resetMockApiTestConfig, setMockApiTestConfig } from './mocks/mockConfig'
import { STORAGE_KEY } from './mocks/mockDb'
import { server } from './test/server'

if (!HTMLDialogElement.prototype.showModal) {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { value(this: HTMLDialogElement) { this.open = true } },
    close: { value(this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')) } },
  })
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  resetMockApiTestConfig()
})

function confirmStageChange() {
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
}

test('cancelling a stage-change confirmation leaves the applicant state unchanged and restores focus', async () => {
  const applicant: Applicant = {
    id: 'applicant-confirmation', name: '김민지', role: 'Frontend Developer', appliedAt: '2026-08-01T09:00:00.000Z',
    stage: 'DOCUMENT_REVIEW', email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3, skills: ['React'], note: '',
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([applicant]))
  let patchRequests = 0
  server.use(http.patch('*/api/applicants/:applicantId/stage', () => {
    patchRequests += 1
    return new Promise<Response>(() => undefined)
  }))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { container } = render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>)

  const documentReviewColumn = await within(container).findByRole('region', { name: '서류검토' })
  const moveForm = within(documentReviewColumn).getByRole('form', { name: '김민지 단계 이동' })
  const moveButton = within(moveForm).getByRole('button', { name: '이동' })
  const cacheBefore = queryClient.getQueryData<Applicant[]>(['applicants'])
  const storageBefore = localStorage.getItem(STORAGE_KEY)

  moveButton.focus()
  fireEvent.change(within(moveForm).getByLabelText('이동할 단계'), { target: { value: 'INTERVIEW' } })
  fireEvent.click(moveButton)

  const dialog = await screen.findByRole('dialog', { name: '김민지 단계 변경 확인' })
  expect(dialog).toHaveAttribute('open')
  expect(dialog).toHaveAttribute('aria-labelledby')
  expect(within(dialog).getByText('현재 단계: 서류검토')).toBeInTheDocument()
  expect(within(dialog).getByText('변경 단계: 면접')).toBeInTheDocument()
  expect(patchRequests).toBe(0)
  expect(queryClient.getQueryData<Applicant[]>(['applicants'])).toEqual(cacheBefore)
  expect(localStorage.getItem(STORAGE_KEY)).toBe(storageBefore)
  expect(within(documentReviewColumn).getByText('김민지')).toBeInTheDocument()

  fireEvent.click(within(dialog).getByRole('button', { name: '취소' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(patchRequests).toBe(0)
  expect(queryClient.getQueryData<Applicant[]>(['applicants'])).toEqual(cacheBefore)
  expect(localStorage.getItem(STORAGE_KEY)).toBe(storageBefore)
  expect(moveButton).toHaveFocus()
})

test('Escape cancels a stage-change confirmation without a PATCH request', async () => {
  const applicant: Applicant = {
    id: 'applicant-escape', name: '이준호', role: 'Product Manager', appliedAt: '2026-08-02T09:00:00.000Z',
    stage: 'INTERVIEW', email: 'junho@example.com', phone: '010-0000-0002', experienceYears: 5, skills: ['Planning'], note: '',
  }
  let patchRequests = 0
  server.use(
    http.get('*/api/applicants', () => HttpResponse.json([applicant])),
    http.patch('*/api/applicants/:applicantId/stage', () => {
      patchRequests += 1
      return HttpResponse.json({ ...applicant, stage: 'OFFER' })
    }),
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { container } = render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>)
  const interviewColumn = await within(container).findByRole('region', { name: '면접' })
  const moveForm = within(interviewColumn).getByRole('form', { name: '이준호 단계 이동' })
  const cacheBefore = queryClient.getQueryData<Applicant[]>(['applicants'])
  const storageBefore = localStorage.getItem(STORAGE_KEY)

  fireEvent.change(within(moveForm).getByLabelText('이동할 단계'), { target: { value: 'OFFER' } })
  fireEvent.click(within(moveForm).getByRole('button', { name: '이동' }))
  const dialog = await screen.findByRole('dialog', { name: '이준호 단계 변경 확인' })
  fireEvent(dialog, new Event('cancel', { cancelable: true }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(patchRequests).toBe(0)
  expect(queryClient.getQueryData<Applicant[]>(['applicants'])).toEqual(cacheBefore)
  expect(localStorage.getItem(STORAGE_KEY)).toBe(storageBefore)
})

test('opens applicant details and restores the trigger focus when the dialog closes', async () => {
  const applicant: Applicant = {
    id: 'applicant-1',
    name: '김민지',
    role: 'Frontend Developer',
    appliedAt: '2026-08-01T09:00:00.000Z',
    stage: 'DOCUMENT_REVIEW',
    email: 'minji@example.com',
    phone: '010-0000-0001',
    experienceYears: 3,
    skills: ['React', 'TypeScript'],
    note: 'B2B SaaS 경험 보유',
  }
  server.use(http.get('*/api/applicants', () => HttpResponse.json([applicant])))

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App />
    </QueryClientProvider>,
  )

  const detailTrigger = await screen.findByRole('button', { name: '김민지 상세 열기' })
  detailTrigger.focus()
  fireEvent.click(detailTrigger)

  const dialog = screen.getByRole('dialog', { name: '김민지 상세 정보' })
  expect(dialog).toHaveAttribute('open')
  expect(dialog).toHaveAttribute('aria-labelledby')
  expect(within(dialog).getByText('Frontend Developer')).toBeInTheDocument()
  expect(within(dialog).getByText('2026.08.01')).toBeInTheDocument()
  expect(within(dialog).getByText('서류검토')).toBeInTheDocument()
  expect(within(dialog).getByText('minji@example.com')).toBeInTheDocument()
  expect(within(dialog).getByText('010-0000-0001')).toBeInTheDocument()
  expect(within(dialog).getByText('3년')).toBeInTheDocument()
  expect(within(dialog).getByText('React, TypeScript')).toBeInTheDocument()
  expect(within(dialog).getByText('B2B SaaS 경험 보유')).toBeInTheDocument()

  fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(detailTrigger).toHaveFocus()
})

test('restores focus after the browser closes the dialog with Escape', async () => {
  const applicant: Applicant = {
    id: 'applicant-1', name: '김민지', role: 'Frontend Developer', appliedAt: '2026-08-01T09:00:00.000Z',
    stage: 'DOCUMENT_REVIEW', email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3, skills: ['React'], note: '',
  }
  server.use(http.get('*/api/applicants', () => HttpResponse.json([applicant])))

  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>)

  const detailTrigger = await screen.findByRole('button', { name: '김민지 상세 열기' })
  detailTrigger.focus()
  fireEvent.click(detailTrigger)

  const dialog = screen.getByRole('dialog', { name: '김민지 상세 정보' }) as HTMLDialogElement
  dialog.close()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(detailTrigger).toHaveFocus()
})

test('restores the board scroll position after closing applicant details', async () => {
  const applicant: Applicant = {
    id: 'applicant-1', name: '김민지', role: 'Frontend Developer', appliedAt: '2026-08-01T09:00:00.000Z',
    stage: 'DOCUMENT_REVIEW', email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3, skills: ['React'], note: '',
  }
  server.use(http.get('*/api/applicants', () => HttpResponse.json([applicant])))

  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>)

  const board = await screen.findByRole('region', { name: '채용 단계 보드' })
  board.scrollLeft = 120
  const detailTrigger = await screen.findByRole('button', { name: '김민지 상세 열기' })
  fireEvent.click(detailTrigger)
  board.scrollLeft = 30

  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(board.scrollLeft).toBe(120)
})

test('keeps the search query and role filter after closing applicant details', async () => {
  const applicants: Applicant[] = [
    {
      id: 'applicant-1', name: '김민지', role: 'Frontend Developer', appliedAt: '2026-08-01T09:00:00.000Z',
      stage: 'DOCUMENT_REVIEW', email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3, skills: ['React'], note: '',
    },
    {
      id: 'applicant-2', name: '이준호', role: 'Product Manager', appliedAt: '2026-08-02T09:00:00.000Z',
      stage: 'DOCUMENT_REVIEW', email: 'junho@example.com', phone: '010-0000-0002', experienceYears: 5, skills: ['Planning'], note: '',
    },
  ]
  server.use(http.get('*/api/applicants', () => HttpResponse.json(applicants)))

  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>)

  await screen.findByText('김민지')
  const nameQuery = screen.getByLabelText('이름 검색')
  const roleFilter = screen.getByLabelText('직무 필터')
  fireEvent.change(nameQuery, { target: { value: '김민지' } })
  fireEvent.change(roleFilter, { target: { value: 'Frontend Developer' } })
  fireEvent.click(await screen.findByRole('button', { name: '김민지 상세 열기' }))
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))

  expect(nameQuery).toHaveValue('김민지')
  expect(roleFilter).toHaveValue('Frontend Developer')
})

test('renders the project shell title', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <App />
    </QueryClientProvider>,
  )

  expect(screen.getByRole('heading', { name: '채용 파이프라인 보드' })).toBeInTheDocument()
})

test('renders the five stage columns in their defined order', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <App />
    </QueryClientProvider>,
  )

  await within(container).findByRole('region', { name: '채용 단계 보드' })
  const stages = ['서류검토', '면접', '처우협의', '최종합격', '불합격']
  const columns = within(container)
    .getAllByRole('region')
    .filter((region) => region.getAttribute('aria-labelledby')?.startsWith('stage-'))

  expect(columns).toHaveLength(stages.length)
  expect(columns.map((column) => column.getAttribute('aria-labelledby'))).toEqual(
    stages.map((_, index) => `stage-${index}`),
  )

  columns.forEach((column, index) => {
    expect(within(column).getByRole('heading', { name: stages[index] })).toBeInTheDocument()
    expect(within(column).getByText(/\d+명/)).toBeInTheDocument()
  })

  const boardViewport = await within(container).findByRole('region', { name: '채용 단계 보드' })
  expect(boardViewport).toHaveClass(styles.boardViewport)
  expect(boardViewport.firstElementChild).toHaveClass(styles.board)
})

test('renders fetched applicants once in their stages with matching counts', async () => {
  const applicants: Applicant[] = [
    {
      id: 'applicant-1',
      name: '김민지',
      role: 'Frontend Developer',
      appliedAt: '2026-08-01T09:00:00.000Z',
      stage: 'DOCUMENT_REVIEW',
      email: 'minji@example.com',
      phone: '010-0000-0001',
      experienceYears: 3,
      skills: ['React'],
      note: '',
    },
    {
      id: 'applicant-2',
      name: '이준호',
      role: 'Product Manager',
      appliedAt: '2026-08-02',
      stage: 'INTERVIEW',
      email: 'junho@example.com',
      phone: '010-0000-0002',
      experienceYears: 5,
      skills: ['Planning'],
      note: '',
    },
  ]
  server.use(http.get('*/api/applicants', () => HttpResponse.json(applicants)))

  const { container } = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App />
    </QueryClientProvider>,
  )

  await within(container).findByText('김민지')
  const documentReviewColumn = await within(container).findByRole('region', { name: '서류검토' })
  const interviewColumn = within(container).getByRole('region', { name: '면접' })

  expect(within(documentReviewColumn).getByText('1명')).toBeInTheDocument()
  expect(within(documentReviewColumn).getByText('김민지')).toBeInTheDocument()
  expect(within(documentReviewColumn).getByText('Frontend Developer')).toBeInTheDocument()
  expect(within(documentReviewColumn).getByText('2026.08.01')).toBeInTheDocument()
  expect(within(documentReviewColumn).getByText('현재 단계: 서류검토')).toBeInTheDocument()
  expect(within(interviewColumn).getByText('1명')).toBeInTheDocument()
  expect(within(interviewColumn).getByText('이준호')).toBeInTheDocument()
  expect(within(container).getAllByText('김민지')).toHaveLength(1)
  expect(within(container).getAllByText('이준호')).toHaveLength(1)
})

test('moves an applicant after the stage PATCH succeeds', async () => {
  const applicant: Applicant = {
    id: 'applicant-1',
    name: '김민지',
    role: 'Frontend Developer',
    appliedAt: '2026-08-01T09:00:00.000Z',
    stage: 'DOCUMENT_REVIEW',
    email: 'minji@example.com',
    phone: '010-0000-0001',
    experienceYears: 3,
    skills: ['React'],
    note: '',
  }
  let requestBody: unknown
  server.use(
    http.get('*/api/applicants', () => HttpResponse.json([applicant])),
    http.patch('*/api/applicants/:applicantId/stage', async ({ request }) => {
      requestBody = await request.json()
      return HttpResponse.json({ ...applicant, stage: 'INTERVIEW' })
    }),
  )

  const { container } = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App />
    </QueryClientProvider>,
  )

  const documentReviewColumn = await within(container).findByRole('region', { name: '서류검토' })
  const interviewColumn = within(container).getByRole('region', { name: '면접' })
  const moveForm = await within(documentReviewColumn).findByRole('form', { name: '김민지 단계 이동' })

  expect(within(moveForm).queryByRole('option', { name: '서류검토' })).not.toBeInTheDocument()
  expect(within(moveForm).getAllByRole('option').map((option) => option.getAttribute('value'))).toEqual(['', 'INTERVIEW', 'REJECTED'])

  fireEvent.change(within(moveForm).getByLabelText('이동할 단계'), { target: { value: 'INTERVIEW' } })
  fireEvent.click(within(moveForm).getByRole('button', { name: '이동' }))
  confirmStageChange()

  expect(await within(interviewColumn).findByText('김민지')).toBeInTheDocument()
  expect(requestBody).toEqual({ stage: 'INTERVIEW' })
  expect(within(documentReviewColumn).queryByText('김민지')).not.toBeInTheDocument()
  expect(await screen.findByRole('status')).toHaveTextContent('김민지님을 면접(으)로 이동했습니다.')
})

test('shows terminal-stage status instead of a move form', async () => {
  const applicants: Applicant[] = [
    {
      id: 'applicant-hired', name: '최종합격자', role: 'Frontend Developer', appliedAt: '2026-08-01T09:00:00.000Z',
      stage: 'HIRED', email: 'hired@example.com', phone: '010-0000-0001', experienceYears: 3, skills: ['React'], note: '',
    },
    {
      id: 'applicant-rejected', name: '불합격자', role: 'Product Manager', appliedAt: '2026-08-02T09:00:00.000Z',
      stage: 'REJECTED', email: 'rejected@example.com', phone: '010-0000-0002', experienceYears: 5, skills: ['Planning'], note: '',
    },
  ]
  server.use(http.get('*/api/applicants', () => HttpResponse.json(applicants)))

  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>)

  for (const [columnName, applicantName] of [['최종합격', '최종합격자'], ['불합격', '불합격자']]) {
    const column = await screen.findByRole('region', { name: columnName })
    const card = within(column).getByRole('heading', { name: applicantName }).closest('article')!
    expect(within(card).getByText('종료된 단계입니다.')).toBeInTheDocument()
    expect(within(card).queryByRole('form')).not.toBeInTheDocument()
  }
})

test('keeps a successfully moved applicant after the app is rendered again', async () => {
  localStorage.clear()
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  const firstRender = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App />
    </QueryClientProvider>,
  )

  const documentReviewColumn = await within(firstRender.container).findByRole('region', { name: '서류검토' })
  const moveForm = (await within(documentReviewColumn).findAllByRole('form'))[0]!
  fireEvent.change(within(moveForm).getByLabelText('이동할 단계'), { target: { value: 'INTERVIEW' } })
  fireEvent.click(within(moveForm).getByRole('button', { name: '이동' }))
  confirmStageChange()
  await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toContainEqual(
    expect.objectContaining({ id: 'applicant-001', stage: 'INTERVIEW' }),
  ))
  expect(await within(firstRender.container).findByRole('region', { name: '면접' })).toHaveTextContent('49명')

  firstRender.unmount()
  const secondRender = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App />
    </QueryClientProvider>,
  )

  await within(await within(secondRender.container).findByRole('region', { name: '면접' })).findByText('49명')
})

test('moves an applicant to the target column before a delayed stage PATCH succeeds', async () => {
  const applicant: Applicant = {
    id: 'applicant-1', name: '김민지', role: 'Frontend Developer', appliedAt: '2026-08-01T09:00:00.000Z',
    stage: 'DOCUMENT_REVIEW', email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3, skills: ['React'], note: '',
  }
  let resolveSuccess: (response: Response) => void = () => undefined
  server.use(
    http.get('*/api/applicants', () => HttpResponse.json([applicant])),
    http.patch('*/api/applicants/:applicantId/stage', () =>
      new Promise<Response>((resolve) => {
        resolveSuccess = resolve
      }),
    ),
  )
  const { container } = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App />
    </QueryClientProvider>,
  )

  const documentReviewColumn = await within(container).findByRole('region', { name: '서류검토' })
  const interviewColumn = within(container).getByRole('region', { name: '면접' })
  const moveForm = await within(documentReviewColumn).findByRole('form', { name: '김민지 단계 이동' })
  fireEvent.change(within(moveForm).getByLabelText('이동할 단계'), { target: { value: 'INTERVIEW' } })
  fireEvent.click(within(moveForm).getByRole('button', { name: '이동' }))
  confirmStageChange()

  expect(await within(interviewColumn).findByRole('heading', { name: '김민지' })).toBeInTheDocument()
  expect(within(documentReviewColumn).queryByRole('heading', { name: '김민지' })).not.toBeInTheDocument()
  const pendingForm = within(interviewColumn).getByRole('form', { name: '김민지 단계 이동' })
  expect(pendingForm).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('status')).toHaveTextContent('김민지님의 단계를 저장하는 중입니다.')
  resolveSuccess(HttpResponse.json({ ...applicant, stage: 'INTERVIEW' }))
  await waitFor(() => expect(within(interviewColumn).getByRole('form', { name: '김민지 단계 이동' })).toHaveAttribute('aria-busy', 'false'))
})

test('keeps the applicant in the current stage and shows feedback when a stage PATCH fails', async () => {
  const applicant: Applicant = {
    id: 'applicant-1',
    name: '김민지',
    role: 'Frontend Developer',
    appliedAt: '2026-08-01T09:00:00.000Z',
    stage: 'DOCUMENT_REVIEW',
    email: 'minji@example.com',
    phone: '010-0000-0001',
    experienceYears: 3,
    skills: ['React'],
    note: '',
  }
  let resolveFailure: (response: Response) => void = () => undefined
  server.use(
    http.get('*/api/applicants', () => HttpResponse.json([applicant])),
    http.patch('*/api/applicants/:applicantId/stage', () =>
      new Promise<Response>((resolve) => {
        resolveFailure = resolve
      }),
    ),
  )

  const { container } = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App />
    </QueryClientProvider>,
  )

  const documentReviewColumn = await within(container).findByRole('region', { name: '서류검토' })
  const interviewColumn = within(container).getByRole('region', { name: '면접' })
  const moveForm = await within(documentReviewColumn).findByRole('form', { name: '김민지 단계 이동' })

  fireEvent.change(within(moveForm).getByLabelText('이동할 단계'), { target: { value: 'INTERVIEW' } })
  fireEvent.click(within(moveForm).getByRole('button', { name: '이동' }))
  confirmStageChange()

  expect(await within(interviewColumn).findByRole('heading', { name: '김민지' })).toBeInTheDocument()
  resolveFailure(HttpResponse.json({ code: 'MOCK_FAILURE', message: '지원자 단계를 저장하지 못했습니다.' }, { status: 503 }))
  expect(await screen.findByRole('alert')).toHaveTextContent('단계 이동을 저장하지 못해 이전 상태로 복원했습니다.')
  expect(within(documentReviewColumn).getByText('김민지')).toBeInTheDocument()
  await waitFor(() => expect(within(documentReviewColumn).getByRole('form', { name: '김민지 단계 이동' })).toHaveAttribute('aria-busy', 'false'))
})

test('restores only the failed applicant when another applicant move succeeds', async () => {
  const applicants: Applicant[] = [
    {
      id: 'applicant-a', name: '김민지', role: 'Frontend Developer', appliedAt: '2026-08-01T09:00:00.000Z',
      stage: 'DOCUMENT_REVIEW', email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3, skills: ['React'], note: '',
    },
    {
      id: 'applicant-b', name: '이준호', role: 'Product Manager', appliedAt: '2026-08-02T09:00:00.000Z',
      stage: 'DOCUMENT_REVIEW', email: 'junho@example.com', phone: '010-0000-0002', experienceYears: 5, skills: ['Planning'], note: '',
    },
  ]
  let resolveA: (response: Response) => void = () => undefined
  let resolveB: (response: Response) => void = () => undefined
  let patchRequests = 0
  server.use(
    http.get('*/api/applicants', () => HttpResponse.json(applicants)),
    http.patch('*/api/applicants/:applicantId/stage', ({ params }) => {
      patchRequests += 1
      return new Promise<Response>((resolve) => {
        if (params.applicantId === 'applicant-a') resolveA = resolve
        else resolveB = resolve
      })
    },
    ),
  )
  const { container } = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>,
  )
  const documentReviewColumn = await within(container).findByRole('region', { name: '서류검토' })
  const interviewColumn = within(container).getByRole('region', { name: '면접' })
  const aForm = await within(documentReviewColumn).findByRole('form', { name: '김민지 단계 이동' })
  fireEvent.change(within(aForm).getByLabelText('이동할 단계'), { target: { value: 'INTERVIEW' } })
  fireEvent.click(within(aForm).getByRole('button', { name: '이동' }))
  confirmStageChange()
  const bForm = within(documentReviewColumn).getByRole('form', { name: '이준호 단계 이동' })
  fireEvent.change(within(bForm).getByLabelText('이동할 단계'), { target: { value: 'INTERVIEW' } })
  fireEvent.click(within(bForm).getByRole('button', { name: '이동' }))
  confirmStageChange()

  expect(await within(interviewColumn).findByText('이준호')).toBeInTheDocument()
  expect(within(interviewColumn).getByText('김민지')).toBeInTheDocument()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(patchRequests).toBe(2)
  resolveA(HttpResponse.json({ code: 'MOCK_FAILURE', message: '지원자 단계를 저장하지 못했습니다.' }, { status: 503 }))

  expect(await within(documentReviewColumn).findByText('김민지')).toBeInTheDocument()
  expect(await screen.findByRole('alert')).toHaveTextContent('단계 이동을 저장하지 못해 이전 상태로 복원했습니다.')
  const pendingBForm = within(interviewColumn).getByRole('form', { name: '이준호 단계 이동' })
  expect(pendingBForm).toHaveAttribute('aria-busy', 'true')
  resolveB(HttpResponse.json({ ...applicants[1], stage: 'INTERVIEW' }))
  await waitFor(() => expect(within(interviewColumn).getByRole('form', { name: '이준호 단계 이동' })).toHaveAttribute('aria-busy', 'false'))
  expect(screen.getByRole('alert')).toHaveTextContent('단계 이동을 저장하지 못해 이전 상태로 복원했습니다.')
  expect(screen.getByRole('status')).toHaveTextContent('이준호님을 면접(으)로 이동했습니다.')
})

test('blocks a rapid second move for the same applicant while its PATCH is pending', async () => {
  const applicant: Applicant = {
    id: 'applicant-1', name: '김민지', role: 'Frontend Developer', appliedAt: '2026-08-01T09:00:00.000Z',
    stage: 'DOCUMENT_REVIEW', email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3, skills: ['React'], note: '',
  }
  let patchRequests = 0
  server.use(
    http.get('*/api/applicants', () => HttpResponse.json([applicant])),
    http.patch('*/api/applicants/:applicantId/stage', async () => {
      patchRequests += 1
      return new Promise(() => undefined)
    }),
  )
  const { container } = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>,
  )
  const form = await within(container).findByRole('form', { name: '김민지 단계 이동' })
  fireEvent.change(within(form).getByLabelText('이동할 단계'), { target: { value: 'INTERVIEW' } })

  fireEvent.submit(form)
  const confirmationButton = screen.getByRole('button', { name: '확인' })
  fireEvent.click(confirmationButton)
  fireEvent.click(confirmationButton)

  expect(within(form).getByLabelText('이동할 단계')).toBeDisabled()
  expect(within(form).getByRole('button', { name: '이동' })).toBeDisabled()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(patchRequests).toBe(1)
})

test('retries a failed applicants query only after the user requests it', async () => {
  let requests = 0
  server.use(
    http.get('*/api/applicants', () => {
      requests += 1
      return requests === 1
        ? HttpResponse.json({ code: 'MOCK_FAILURE', message: '지원자 목록을 불러오지 못했습니다.' }, { status: 503 })
        : HttpResponse.json([
            {
              id: 'applicant-1',
              name: '김민지',
              role: 'Frontend Developer',
              appliedAt: '2026-08-01T09:00:00.000Z',
              stage: 'DOCUMENT_REVIEW',
              email: 'minji@example.com',
              phone: '010-0000-0001',
              experienceYears: 3,
              skills: ['React'],
              note: '',
            },
          ])
    }),
  )

  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <App />
    </QueryClientProvider>,
  )

  const retryButton = await within(container).findByRole('button', { name: '다시 시도' })
  expect(requests).toBe(1)

  fireEvent.click(retryButton)

  expect(await within(container).findByText('김민지')).toBeInTheDocument()
  expect(requests).toBe(2)
})

test('filters stage cards and counts by name and role, then resets both filters', async () => {
  const applicants: Applicant[] = [
    {
      id: 'applicant-1', name: 'Alex Kim', role: 'Frontend Developer', appliedAt: '2026-08-01T09:00:00.000Z',
      stage: 'DOCUMENT_REVIEW', email: 'alex@example.com', phone: '010-0000-0001', experienceYears: 3, skills: ['React'], note: '',
    },
    {
      id: 'applicant-2', name: 'Alex Park', role: 'Product Designer', appliedAt: '2026-08-02T09:00:00.000Z',
      stage: 'INTERVIEW', email: 'park@example.com', phone: '010-0000-0002', experienceYears: 5, skills: ['Figma'], note: '',
    },
  ]
  server.use(http.get('*/api/applicants', () => HttpResponse.json(applicants)))

  const { container } = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App />
    </QueryClientProvider>,
  )

  await within(container).findByText('Alex Kim')
  fireEvent.change(within(container).getByLabelText('이름 검색'), { target: { value: '  aLeX  ' } })
  fireEvent.change(within(container).getByLabelText('직무 필터'), { target: { value: 'Frontend Developer' } })

  const documentReviewColumn = within(container).getByRole('region', { name: '서류검토' })
  const interviewColumn = within(container).getByRole('region', { name: '면접' })
  expect(within(documentReviewColumn).getByText('1명')).toBeInTheDocument()
  expect(within(documentReviewColumn).getByText('Alex Kim')).toBeInTheDocument()
  expect(within(interviewColumn).getByText('0명')).toBeInTheDocument()
  expect(within(interviewColumn).queryByText('Alex Park')).not.toBeInTheDocument()

  fireEvent.click(within(container).getByRole('button', { name: '필터 초기화' }))

  expect(await within(interviewColumn).findByText('Alex Park')).toBeInTheDocument()
})

test('shows an accessible loading board while the applicants query is pending', () => {
  server.use(http.get('*/api/applicants', () => new Promise<Response>(() => undefined)))

  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>)

  const loadingBoard = screen.getByRole('region', { name: '지원자 정보 로딩' })
  expect(loadingBoard).toHaveAttribute('aria-busy', 'true')
  expect(within(loadingBoard).getByText('지원자 정보를 불러오는 중입니다.')).toBeInTheDocument()
})

test('shows a non-technical query error and restores the board after retry succeeds', async () => {
  const applicant: Applicant = {
    id: 'applicant-1', name: '김민지', role: 'Frontend Developer', appliedAt: '2026-08-01T09:00:00.000Z',
    stage: 'DOCUMENT_REVIEW', email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3, skills: ['React'], note: '',
  }
  let requests = 0
  server.use(http.get('*/api/applicants', () => {
    requests += 1
    return requests === 1
      ? HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'database password leaked' }, { status: 503 })
      : HttpResponse.json([applicant])
  }))

  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>)

  const error = await screen.findByRole('alert')
  expect(error).toHaveTextContent('지원자 정보를 불러오지 못했습니다.')
  expect(error).not.toHaveTextContent('database password leaked')

  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

  expect(await screen.findByRole('region', { name: '채용 단계 보드' })).toBeInTheDocument()
  expect(screen.getByText('김민지')).toBeInTheDocument()
  expect(requests).toBe(2)
})

test('shows a distinct empty state when the source applicants list is empty', async () => {
  server.use(http.get('*/api/applicants', () => HttpResponse.json([])))

  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>)

  expect(await screen.findByText('등록된 지원자가 없습니다.')).toBeInTheDocument()
  expect(screen.queryByText('현재 검색 조건에 맞는 지원자가 없습니다.')).not.toBeInTheDocument()
})

test('shows a filter empty state and resets the existing filters', async () => {
  const applicant: Applicant = {
    id: 'applicant-1', name: '김민지', role: 'Frontend Developer', appliedAt: '2026-08-01T09:00:00.000Z',
    stage: 'DOCUMENT_REVIEW', email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3, skills: ['React'], note: '',
  }
  server.use(http.get('*/api/applicants', () => HttpResponse.json([applicant])))

  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>)

  await screen.findByText('김민지')
  fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: '없는 이름' } })

  const emptyState = await screen.findByText('현재 검색 조건에 맞는 지원자가 없습니다.')
  fireEvent.click(within(emptyState.closest('section')!).getByRole('button', { name: '필터 초기화' }))
  expect(await screen.findByText('김민지')).toBeInTheDocument()
})

test('shows a short empty state only in stages without filtered applicants', async () => {
  const applicant: Applicant = {
    id: 'applicant-1', name: '김민지', role: 'Frontend Developer', appliedAt: '2026-08-01T09:00:00.000Z',
    stage: 'DOCUMENT_REVIEW', email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3, skills: ['React'], note: '',
  }
  server.use(http.get('*/api/applicants', () => HttpResponse.json([applicant])))

  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>)

  const interviewColumn = await screen.findByRole('region', { name: '면접' })
  expect(within(interviewColumn).getByText('이 단계에는 지원자가 없습니다.')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: '서류검토' })).queryByText('이 단계에는 지원자가 없습니다.')).not.toBeInTheDocument()
})
