import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App'
import styles from './App.module.css'

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
