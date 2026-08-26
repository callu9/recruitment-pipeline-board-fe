import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { applicantsQueryKey } from './useApplicantsQuery'
import { moveApplicantOptimistically, replaceApplicant } from '../model/applicantCache'
import type { Applicant, ApplicantStage } from '../model/applicant.types'

async function moveApplicantStage(applicantId: string, stage: ApplicantStage): Promise<Applicant> {
  const response = await fetch(`/api/applicants/${applicantId}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
  })
  if (!response.ok) throw new Error('단계 이동을 저장하지 못했습니다.')

  return response.json()
}

export function useMoveApplicantStage() {
  const queryClient = useQueryClient()
  const pendingIdsRef = useRef(new Set<string>())
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [moveError, setMoveError] = useState('')
  const mutation = useMutation({
    mutationFn: ({ applicantId, targetStage }: { applicantId: string; targetStage: ApplicantStage }) =>
      moveApplicantStage(applicantId, targetStage),
    onMutate: async ({ applicantId, targetStage }) => {
      await queryClient.cancelQueries({ queryKey: applicantsQueryKey })
      const previousApplicant = queryClient.getQueryData<Applicant[]>(applicantsQueryKey)?.find((applicant) => applicant.id === applicantId)
      if (!previousApplicant) return undefined

      queryClient.setQueryData<Applicant[]>(applicantsQueryKey, (current = []) =>
        moveApplicantOptimistically(current, applicantId, targetStage),
      )
      return { previousApplicant }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousApplicant) {
        queryClient.setQueryData<Applicant[]>(applicantsQueryKey, (current = []) =>
          replaceApplicant(current, context.previousApplicant),
        )
      }
      setMoveError('단계 이동을 저장하지 못했습니다.')
    },
    onSuccess: (updatedApplicant) => {
      setMoveError('')
      queryClient.setQueryData<Applicant[]>(applicantsQueryKey, (current = []) => replaceApplicant(current, updatedApplicant))
    },
    onSettled: (_data, _error, { applicantId }) => {
      pendingIdsRef.current.delete(applicantId)
      setPendingIds((current) => {
        const next = new Set(current)
        next.delete(applicantId)
        return next
      })
    },
  })

  function move(applicantId: string, targetStage: ApplicantStage) {
    if (pendingIdsRef.current.has(applicantId)) return

    pendingIdsRef.current.add(applicantId)
    setPendingIds((current) => new Set(current).add(applicantId))
    mutation.mutate({ applicantId, targetStage })
  }

  return { move, moveError, pendingIds }
}
