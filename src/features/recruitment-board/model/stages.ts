import {
  APPLICANT_OWNERS,
  type Applicant,
  type ApplicantStage,
  type EvaluationType,
  type SubmitApplicantFeedbackRequest,
} from './applicant.types'

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

export const STAGE_EVALUATION_TYPES: Partial<Record<ApplicantStage, EvaluationType>> = {
  DOCUMENT_REVIEW: 'SCREEN',
  INTERVIEW: 'INTERVIEW',
  OFFER: 'FINAL',
}

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

export function getCurrentStageEvaluation(applicant: Applicant) {
  const type = STAGE_EVALUATION_TYPES[applicant.stage]
  return type ? applicant.evaluations?.find((evaluation) => evaluation.type === type) : undefined
}

export function submitApplicantEvaluation(
  applicant: Applicant,
  evaluationId: string,
  values: SubmitApplicantFeedbackRequest,
  submittedAt: string,
): Applicant {
  if (!applicant.evaluations?.some(({ id }) => id === evaluationId)) return applicant

  return {
    ...applicant,
    evaluations: applicant.evaluations.map((evaluation) => evaluation.id === evaluationId
      ? {
          ...evaluation,
          status: 'SUBMITTED',
          reviewer: values.reviewer,
          score: values.score,
          comment: values.comment.trim(),
          submittedAt,
        }
      : evaluation),
    timeline: [
      ...(applicant.timeline ?? []),
      {
        id: `timeline-${applicant.id}-${(applicant.timeline ?? []).length + 1}`,
        at: submittedAt,
        label: `${stageLabel(applicant.stage)} 피드백 작성`,
      },
    ],
  }
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
  const targetEvaluationType = STAGE_EVALUATION_TYPES[targetStage]
  const targetSchedule = targetStage === 'INTERVIEW' ? applicant.schedule : null
  const scheduleReviewer = APPLICANT_OWNERS.find((owner) => owner === targetSchedule?.interviewer)
  const evaluations = targetEvaluationType
    && !(applicant.evaluations ?? []).some(({ type }) => type === targetEvaluationType)
    ? [
        ...(applicant.evaluations ?? []),
        {
          id: `evaluation-${applicant.id}-${targetEvaluationType.toLowerCase()}`,
          type: targetEvaluationType,
          status: 'PENDING' as const,
          dueDate: targetSchedule?.date ?? transitionAt,
          reviewer: scheduleReviewer ?? applicant.owner ?? APPLICANT_OWNERS[0],
        },
      ]
    : applicant.evaluations
  return {
    ...applicant,
    stage: targetStage,
    nextAction,
    rejectionReason: targetStage === 'REJECTED' ? options.rejectionReason?.trim() : undefined,
    rejectionMemo: targetStage === 'REJECTED' ? options.rejectionMemo?.trim() || undefined : undefined,
    evaluations,
    timeline,
  }
}

export function getAllowedNextStages(currentStage: ApplicantStage) {
  return ALLOWED_NEXT_STAGES[currentStage]
}

export function canTransitionTo(currentStage: ApplicantStage, targetStage: ApplicantStage) {
  return getAllowedNextStages(currentStage).includes(targetStage)
}
