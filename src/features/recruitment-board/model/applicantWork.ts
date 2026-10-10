import type { Applicant } from './applicant.types'
import { getLocalDateString } from './stages'
import { isActiveEvaluation, isPendingFollowUp, isPendingOfferResponse, isPendingStart, needsInterviewSchedule, isRecruiting } from './workspaceSelectors'

export type ApplicantWorkTarget = 'evaluation' | 'progress' | '면접 일정 관리' | '오퍼 관리' | '입사 관리' | '후속 업무 관리' | '연락 기록' | '담당 업무 편집' | '지원 상태 관리' | '보관·복원'
export interface ApplicantWork { label: string; target: ApplicantWorkTarget; reason: string; dueDate?: string }

/** A view recommendation only: mutations still enforce existing domain policies. */
export function getApplicantWork(applicant: Applicant, today = getLocalDateString()): ApplicantWork {
  if (applicant.talentPool && applicant.reconnectDate && applicant.reconnectDate <= today) return { label: '재접촉 기록', target: '연락 기록', dueDate: applicant.reconnectDate, reason: '인재풀의 재접촉 기한을 확인해 주세요.' }
  if (applicant.archivedAt) return { label: '보관 기록 확인', target: '보관·복원', reason: '보관된 지원 건입니다. 지원 정보에서 복원 여부를 확인하세요.' }
  const followUp = applicant.followUps?.filter((task) => isPendingFollowUp(applicant, task)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  if (followUp && followUp.dueDate <= today) return { label: '후속 업무 처리', target: '후속 업무 관리', dueDate: followUp.dueDate, reason: followUp.label }
  if (followUp && applicant.lifecycle && applicant.lifecycle !== 'ACTIVE') return { label: '후속 업무 처리', target: '후속 업무 관리', dueDate: followUp.dueDate, reason: followUp.label }
  if (applicant.lifecycle && applicant.lifecycle !== 'ACTIVE') return { label: '지원 상태 확인', target: '지원 상태 관리', reason: '현재 지원 상태와 재개 조건을 확인해 주세요.' }
  if (needsInterviewSchedule(applicant)) return { label: '면접 일정 등록', target: '면접 일정 관리', dueDate: applicant.dueDate, reason: '현재 면접 단계의 진행 가능한 일정이 없습니다.' }
  const evaluation = applicant.evaluations?.filter((item) => isActiveEvaluation(applicant, item) && item.status === 'PENDING').sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  if (evaluation) return { label: '평가 작성', target: 'evaluation', dueDate: evaluation.dueDate, reason: '현재 전형의 평가자·점수·근거 코멘트를 작성해 주세요.' }
  if (isPendingOfferResponse(applicant)) return { label: '오퍼 응답 확인', target: '오퍼 관리', dueDate: applicant.offer?.responseDueDate, reason: '발송한 오퍼의 응답과 다음 업무를 기록해 주세요.' }
  if (isPendingStart(applicant)) return { label: '입사 확인', target: '입사 관리', dueDate: applicant.employment?.plannedStartDate, reason: '입사 예정일과 실제 입사 여부를 확인해 주세요.' }
  if (isRecruiting(applicant) && applicant.stage === 'INTERVIEW' && applicant.schedule?.status !== 'COMPLETED') return { label: '면접 일정 확인', target: '면접 일정 관리', dueDate: applicant.schedule?.date, reason: '면접 일정과 진행 결과를 확인해 주세요.' }
  if (isRecruiting(applicant) && applicant.stage === 'OFFER' && applicant.offer?.status !== 'ACCEPTED') return { label: '오퍼 준비', target: '오퍼 관리', dueDate: applicant.dueDate, reason: '오퍼 조건과 발송 상태를 기록해 주세요.' }
  if (followUp) return { label: '후속 업무 처리', target: '후속 업무 관리', dueDate: followUp.dueDate, reason: followUp.label }
  if (isRecruiting(applicant)) return { label: '전형 진행 검토', target: 'progress', dueDate: applicant.dueDate, reason: '현재 전형의 업무를 확인한 뒤 다음 단계 진행을 검토하세요.' }
  return { label: '지원 기록 확인', target: '지원 상태 관리', reason: '종료된 지원 건의 정보와 후속 기록을 확인하세요.' }
}
export function isSupportWork(target: ApplicantWorkTarget) { return target === '지원 상태 관리' || target === '보관·복원' }
