import { useQuery } from '@tanstack/react-query'
import type { Applicant } from '../model/applicant.types'

export const applicantsQueryKey = ['applicants'] as const

async function fetchApplicants(): Promise<Applicant[]> {
  const response = await fetch('/api/applicants')
  if (!response.ok) throw new Error('지원자 목록을 불러오지 못했습니다.')

  return response.json()
}

export function useApplicantsQuery() {
  return useQuery({ queryKey: applicantsQueryKey, queryFn: fetchApplicants, retry: false })
}
