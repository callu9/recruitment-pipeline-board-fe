import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import type { Applicant, SubmitApplicantFeedbackRequest } from '../model/applicant.types'
import { replaceApplicant } from '../model/applicantCache'
import { applicantsQueryKey } from './useApplicantsQuery'

type FeedbackVariables = SubmitApplicantFeedbackRequest & {
  applicantId: string
  evaluationId: string
}

async function patchApplicantFeedback({ applicantId, evaluationId, ...body }: FeedbackVariables) {
  const response = await fetch(`/api/applicants/${applicantId}/evaluations/${evaluationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('피드백을 저장하지 못했습니다.')
  return response.json() as Promise<Applicant>
}

export function useSubmitApplicantFeedback({ onError, onSuccess }: {
  onError: (variables: FeedbackVariables) => void
  onSuccess: (applicant: Applicant, variables: FeedbackVariables) => void
}) {
  const queryClient = useQueryClient()
  const pendingIdsRef = useRef(new Set<string>())
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const mutation = useMutation({
    mutationFn: patchApplicantFeedback,
    onSuccess: (applicant, variables) => {
      queryClient.setQueryData<Applicant[]>(applicantsQueryKey, (current = []) =>
        replaceApplicant(current, applicant))
      onSuccess(applicant, variables)
    },
    onError: (_error, variables) => onError(variables),
    onSettled: (_data, _error, { applicantId }) => {
      pendingIdsRef.current.delete(applicantId)
      setPendingIds((current) => {
        const next = new Set(current)
        next.delete(applicantId)
        return next
      })
    },
  })

  function submitFeedback(applicantId: string, evaluationId: string, values: SubmitApplicantFeedbackRequest) {
    if (pendingIdsRef.current.has(applicantId)) return
    pendingIdsRef.current.add(applicantId)
    setPendingIds((current) => new Set(current).add(applicantId))
    mutation.mutate({ applicantId, evaluationId, ...values })
  }

  return { submitFeedback, pendingIds }
}
