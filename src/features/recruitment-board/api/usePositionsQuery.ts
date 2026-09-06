import { useQuery } from '@tanstack/react-query'
import type { Position } from '../model/applicant.types'

export const positionsQueryKey = ['positions'] as const

async function fetchPositions(): Promise<Position[]> {
  const response = await fetch('/api/positions')
  if (!response.ok) throw new Error('포지션 정보를 불러오지 못했습니다.')
  return response.json()
}

export function usePositionsQuery() {
  return useQuery({ queryKey: positionsQueryKey, queryFn: fetchPositions, retry: false })
}
