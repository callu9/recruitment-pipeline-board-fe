import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Applicant, ApplicantOwner } from '../model/applicant.types'
import type { ApplicantOperation } from '../model/operations'
import { replaceApplicant } from '../model/applicantCache'
import { applicantsQueryKey } from './useApplicantsQuery'
import { getApplicantPending } from './applicantPending'

export function useApplicantOperation() {
  const client = useQueryClient()
  const [pendingIds, setPendingIds] = useState(new Set<string>())
  async function save(id: string, operation: ApplicantOperation, actor: ApplicantOwner): Promise<string | null> {
    const pending = getApplicantPending(client)
    if (pending.has(id)) return '다른 저장이 진행 중입니다. 완료 후 다시 시도해 주세요.'
    pending.add(id)
    setPendingIds((current) => new Set(current).add(id))
    try {
      await client.cancelQueries({ queryKey: applicantsQueryKey })
      const response = await fetch(`/api/applicants/${encodeURIComponent(id)}/operations`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation, actor }) })
      if (!response.ok) { const body = await response.json(); throw new Error(body.message ?? '저장에 실패했습니다.') }
      const updated = await response.json() as Applicant
      client.setQueryData<Applicant[]>(applicantsQueryKey, (current = []) => updated.deletedAt ? current.filter((item) => item.id !== id) : replaceApplicant(current, updated))
      if (updated.deletedAt) {
        try {
        for (const evaluation of updated.evaluations ?? []) sessionStorage.removeItem(`recruitment-feedback-draft:${evaluation.id}`)
        for (const key of Object.keys(sessionStorage)) if (key.startsWith(`recruitment-operation-draft:${id}:`)) sessionStorage.removeItem(key)
        } catch { /* Draft storage cannot undo a confirmed application deletion. */ }
      }
      return null
    } catch (cause) { return cause instanceof Error ? cause.message : '저장에 실패했습니다. 다시 시도해 주세요.' }
    finally {
      pending.delete(id)
      setPendingIds((current) => { const next = new Set(current); next.delete(id); return next })
    }
  }
  return { save, pendingIds }
}
