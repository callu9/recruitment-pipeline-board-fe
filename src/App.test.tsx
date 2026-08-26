import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, expect, test } from 'vitest'
import App from './App'
import styles from './App.module.css'
import type { Applicant } from './features/recruitment-board/model/applicant.types'
import { resetMockApiTestConfig, setMockApiTestConfig } from './mocks/mockConfig'
import { server } from './test/server'

afterEach(() => {
  localStorage.clear()
  resetMockApiTestConfig()
})

test('renders the project shell title', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <App />
    </QueryClientProvider>,
  )

  expect(screen.getByRole('heading', { name: '채용 파이프라인 보드' })).toBeInTheDocument()
})

test('renders the five stage columns in their defined order', () => {
  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <App />
    </QueryClientProvider>,
  )

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
    expect(within(column).getByText('0명')).toBeInTheDocument()
  })

  const boardViewport = within(container).getByRole('region', { name: '채용 단계 보드' })
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
  const documentReviewColumn = within(container).getByRole('region', { name: '서류검토' })
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

  const documentReviewColumn = within(container).getByRole('region', { name: '서류검토' })
  const interviewColumn = within(container).getByRole('region', { name: '면접' })
  const moveForm = await within(documentReviewColumn).findByRole('form', { name: '김민지 단계 이동' })

  expect(within(moveForm).queryByRole('option', { name: '서류검토' })).not.toBeInTheDocument()

  fireEvent.change(within(moveForm).getByLabelText('이동할 단계'), { target: { value: 'INTERVIEW' } })
  fireEvent.click(within(moveForm).getByRole('button', { name: '이동' }))

  expect(await within(interviewColumn).findByText('김민지')).toBeInTheDocument()
  expect(requestBody).toEqual({ stage: 'INTERVIEW' })
  expect(within(documentReviewColumn).queryByText('김민지')).not.toBeInTheDocument()
})

test('keeps a successfully moved applicant after the app is rendered again', async () => {
  localStorage.clear()
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  const firstRender = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App />
    </QueryClientProvider>,
  )

  const documentReviewColumn = within(firstRender.container).getByRole('region', { name: '서류검토' })
  const moveForm = await within(documentReviewColumn).findByRole('form', { name: '지원자 001 단계 이동' })
  fireEvent.change(within(moveForm).getByLabelText('이동할 단계'), { target: { value: 'INTERVIEW' } })
  fireEvent.click(within(moveForm).getByRole('button', { name: '이동' }))
  await within(within(firstRender.container).getByRole('region', { name: '면접' })).findByRole('heading', {
    name: '지원자 001',
  })

  firstRender.unmount()
  const secondRender = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App />
    </QueryClientProvider>,
  )

  await within(within(secondRender.container).getByRole('region', { name: '면접' })).findByRole('heading', {
    name: '지원자 001',
  })
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

  const documentReviewColumn = within(container).getByRole('region', { name: '서류검토' })
  const interviewColumn = within(container).getByRole('region', { name: '면접' })
  const moveForm = await within(documentReviewColumn).findByRole('form', { name: '김민지 단계 이동' })
  fireEvent.change(within(moveForm).getByLabelText('이동할 단계'), { target: { value: 'INTERVIEW' } })
  fireEvent.click(within(moveForm).getByRole('button', { name: '이동' }))

  expect(await within(interviewColumn).findByRole('heading', { name: '김민지' })).toBeInTheDocument()
  expect(within(documentReviewColumn).queryByRole('heading', { name: '김민지' })).not.toBeInTheDocument()
  const pendingForm = within(interviewColumn).getByRole('form', { name: '김민지 단계 이동' })
  expect(pendingForm).toHaveAttribute('aria-busy', 'true')
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

  const documentReviewColumn = within(container).getByRole('region', { name: '서류검토' })
  const interviewColumn = within(container).getByRole('region', { name: '면접' })
  const moveForm = await within(documentReviewColumn).findByRole('form', { name: '김민지 단계 이동' })

  fireEvent.change(within(moveForm).getByLabelText('이동할 단계'), { target: { value: 'INTERVIEW' } })
  fireEvent.click(within(moveForm).getByRole('button', { name: '이동' }))

  expect(await within(interviewColumn).findByRole('heading', { name: '김민지' })).toBeInTheDocument()
  resolveFailure(HttpResponse.json({ code: 'MOCK_FAILURE', message: '지원자 단계를 저장하지 못했습니다.' }, { status: 503 }))
  expect(await screen.findByRole('alert')).toHaveTextContent('단계 이동을 저장하지 못했습니다.')
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
  const documentReviewColumn = within(container).getByRole('region', { name: '서류검토' })
  const interviewColumn = within(container).getByRole('region', { name: '면접' })
  const aForm = await within(documentReviewColumn).findByRole('form', { name: '김민지 단계 이동' })
  const bForm = within(documentReviewColumn).getByRole('form', { name: '이준호 단계 이동' })

  for (const form of [aForm, bForm]) {
    fireEvent.change(within(form).getByLabelText('이동할 단계'), { target: { value: 'INTERVIEW' } })
    fireEvent.click(within(form).getByRole('button', { name: '이동' }))
  }

  expect(await within(interviewColumn).findByText('이준호')).toBeInTheDocument()
  expect(within(interviewColumn).getByText('김민지')).toBeInTheDocument()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(patchRequests).toBe(2)
  resolveA(HttpResponse.json({ code: 'MOCK_FAILURE', message: '지원자 단계를 저장하지 못했습니다.' }, { status: 503 }))

  expect(await within(documentReviewColumn).findByText('김민지')).toBeInTheDocument()
  const pendingBForm = within(interviewColumn).getByRole('form', { name: '이준호 단계 이동' })
  expect(pendingBForm).toHaveAttribute('aria-busy', 'true')
  resolveB(HttpResponse.json({ ...applicants[1], stage: 'INTERVIEW' }))
  await waitFor(() => expect(within(interviewColumn).getByRole('form', { name: '이준호 단계 이동' })).toHaveAttribute('aria-busy', 'false'))
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
  fireEvent.submit(form)

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
