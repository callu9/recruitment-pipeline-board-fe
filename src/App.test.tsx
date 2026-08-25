import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { expect, test } from 'vitest'
import App from './App'
import styles from './App.module.css'
import type { Applicant } from './features/recruitment-board/model/applicant.types'
import { server } from './test/server'

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
