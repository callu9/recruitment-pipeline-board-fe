import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { applicantsQueryKey } from './useApplicantsQuery'
import { moveApplicantOptimistically, replaceApplicant } from '../model/applicantCache'
import { getLocalDateString, type StageTransitionOptions } from '../model/stages'
import type { Applicant, ApplicantStage, MoveApplicantStageRequest } from '../model/applicant.types'

type MoveVariables = { applicantId: string; targetStage: ApplicantStage; transitionAt: string } & StageTransitionOptions

async function moveApplicantStage({ applicantId, targetStage, transitionAt, correction, rejectionReason, rejectionMemo }: MoveVariables): Promise<Applicant> {
  const response = await fetch(`/api/applicants/${applicantId}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage: targetStage, transitionAt, correction, rejectionReason, rejectionMemo } satisfies MoveApplicantStageRequest),
  })
  if (!response.ok) throw new Error('단계 이동을 저장하지 못했습니다.')

  return response.json()
}

export function useMoveApplicantStage({ onError, onSuccess }: {
  onError: (applicant?: Applicant) => void
  onSuccess: (applicant: Applicant) => void
}) {
  const queryClient = useQueryClient()
  const pendingIdsRef = useRef(new Set<string>())
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const mutation = useMutation({
    mutationFn: moveApplicantStage,
    onMutate: async ({ applicantId, targetStage, transitionAt, correction, rejectionReason, rejectionMemo }) => {
      await queryClient.cancelQueries({ queryKey: applicantsQueryKey })
      const previousApplicant = queryClient.getQueryData<Applicant[]>(applicantsQueryKey)?.find((applicant) => applicant.id === applicantId)
      if (!previousApplicant) return undefined

      queryClient.setQueryData<Applicant[]>(applicantsQueryKey, (current = []) =>
        moveApplicantOptimistically(current, applicantId, targetStage, transitionAt, { correction, rejectionReason, rejectionMemo }),
      )
      return { previousApplicant }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousApplicant) {
        queryClient.setQueryData<Applicant[]>(applicantsQueryKey, (current = []) =>
          replaceApplicant(current, context.previousApplicant),
        )
      }
      onError(context?.previousApplicant)
    },
    onSuccess: (updatedApplicant) => {
      queryClient.setQueryData<Applicant[]>(applicantsQueryKey, (current = []) => replaceApplicant(current, updatedApplicant))
      onSuccess(updatedApplicant)
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

  function move(applicantId: string, targetStage: ApplicantStage, options: StageTransitionOptions = {}) {
    if (pendingIdsRef.current.has(applicantId)) return

    pendingIdsRef.current.add(applicantId)
    setPendingIds((current) => new Set(current).add(applicantId))
    mutation.mutate({ applicantId, targetStage, transitionAt: getLocalDateString(), ...options })
  }

  return { move, pendingIds }
}
