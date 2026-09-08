import type { Applicant, ApplicantStage } from './applicant.types'

export const STAGES = [
  { code: 'DOCUMENT_REVIEW', label: '서류검토' },
  { code: 'INTERVIEW', label: '면접' },
  { code: 'OFFER', label: '처우협의' },
  { code: 'HIRED', label: '최종합격' },
  { code: 'REJECTED', label: '불합격' },
] as const satisfies ReadonlyArray<{ code: ApplicantStage; label: string }>

export const ALLOWED_NEXT_STAGES: Readonly<Record<ApplicantStage, readonly ApplicantStage[]>> = {
  DOCUMENT_REVIEW: ['INTERVIEW', 'REJECTED'],
  INTERVIEW: ['OFFER', 'REJECTED'],
  OFFER: ['HIRED', 'REJECTED'],
  HIRED: [],
  REJECTED: [],
}

export const TERMINAL_STAGES: readonly ApplicantStage[] = ['HIRED', 'REJECTED']

export function isTerminalStage(stage: ApplicantStage) {
  return TERMINAL_STAGES.includes(stage)
}

const stageLabel = (stage: ApplicantStage) => STAGES.find(({ code }) => code === stage)?.label ?? stage

export function getLocalDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getForwardActionLabel(currentStage: ApplicantStage) {
  const destination = getAllowedNextStages(currentStage).find((stage) => stage !== 'REJECTED')
  if (!destination) return '종료됨'
  if (destination === 'HIRED') return '최종 합격'
  if (destination === 'OFFER') return '처우 협의'
  return '면접 집행'
}

export interface StageTransitionOptions {
  correction?: boolean
  rejectionReason?: string
  rejectionMemo?: string
}

export function applyStageTransition(
  applicant: Applicant,
  targetStage: ApplicantStage,
  transitionAt: string,
  options: StageTransitionOptions = {},
): Applicant {
  const timeline = [
    ...(applicant.timeline ?? []),
    {
      id: `timeline-${applicant.id}-${(applicant.timeline ?? []).length + 1}`,
      at: transitionAt,
      label: `${stageLabel(applicant.stage)} → ${stageLabel(targetStage)}${options.correction ? ' (단계 정정)' : ''}`,
    },
  ]
  const nextAction = targetStage === 'INTERVIEW'
    ? (applicant.schedule ? '인터뷰 준비' : '인터뷰 일정 등록')
    : targetStage === 'OFFER'
      ? '처우안 발송'
      : targetStage === 'DOCUMENT_REVIEW'
        ? '서류 검토'
        : undefined
  return {
    ...applicant,
    stage: targetStage,
    nextAction,
    rejectionReason: targetStage === 'REJECTED' ? options.rejectionReason?.trim() : undefined,
    rejectionMemo: targetStage === 'REJECTED' ? options.rejectionMemo?.trim() || undefined : undefined,
    timeline,
  }
}

export function getAllowedNextStages(currentStage: ApplicantStage) {
  return ALLOWED_NEXT_STAGES[currentStage]
}

export function canTransitionTo(currentStage: ApplicantStage, targetStage: ApplicantStage) {
  return getAllowedNextStages(currentStage).includes(targetStage)
}
