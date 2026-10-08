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

export function getLocalDateString(date: Date | string = new Date()) {
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
    date = new Date(date)
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function hasActiveOffer(applicant: Applicant) {
  return !applicant.archivedAt && (!applicant.lifecycle || applicant.lifecycle === 'ACTIVE') && ['OFFER', 'HIRED'].includes(applicant.stage) && applicant.offer?.active !== false
}

export function canRecordEmployment(applicant: Applicant) {
  return hasActiveOffer(applicant) && applicant.stage === 'HIRED' && applicant.offer?.status === 'ACCEPTED'
}

export function getStageTransitionBlockers(applicant: Applicant, target: ApplicantStage) {
  const blockers: string[] = []
  if (applicant.archivedAt || (applicant.lifecycle && applicant.lifecycle !== 'ACTIVE')) blockers.push('보관·보류·종료한 지원 건은 복원 또는 재개 후 진행하세요.')
  if (applicant.employment?.actualStartDate && target !== applicant.stage) blockers.push('실제 입사 후에는 전형 단계를 변경할 수 없습니다.')
  return blockers
}

export function retireRecruitmentWork(applicant: Applicant, at: string, notify = true): Applicant {
  if (applicant.employment?.actualStartDate) throw new Error('실제 입사 후에는 철회·거절로 종료할 수 없습니다.')
  let offer = applicant.offer
  if (offer && applicant.lifecycle === 'OFFER_DECLINED' && offer.status !== 'DECLINED') {
    const { history, ...previous } = offer
    offer = { ...offer, status: 'DECLINED', reason: applicant.lifecycleReason ?? '', history: [...(history ?? []), previous] }
  }
  return {
    ...applicant, dueDate: undefined,
    schedule: applicant.schedule ? { ...applicant.schedule, active: false } : applicant.schedule,
    evaluations: applicant.evaluations?.map((evaluation) => ({ ...evaluation, resumeOnReactivation: evaluation.active !== false || evaluation.resumeOnReactivation === true, active: false })),
    offer: offer ? { ...offer, active: false } : offer,
    employment: applicant.employment ? { ...applicant.employment, active: false } : applicant.employment,
    followUps: [...(applicant.followUps ?? []).map((task) => /^(result-|handoff-|lifecycle-result-)/.test(task.id) ? { ...task, active: false } : task),
      ...(notify ? [{ id: `lifecycle-result-${applicant.id}-${(applicant.timeline ?? []).length + 1}`, label: '종료 확인 통보', dueDate: getLocalDateString(at), done: false }] : [])],
  }
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
  return type ? applicant.evaluations?.findLast((evaluation) => evaluation.type === type && evaluation.active !== false) : undefined
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
          revisions: evaluation.status === 'SUBMITTED' ? [...(evaluation.revisions ?? []), { reviewer: evaluation.reviewer, score: evaluation.score, comment: evaluation.comment, submittedAt: evaluation.submittedAt, reason: values.correctionReason }] : evaluation.revisions,
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
        label: `${evaluationLabel(applicant.evaluations.find(({ id }) => id === evaluationId)!.type)} 피드백 ${applicant.evaluations.find(({ id }) => id === evaluationId)?.status === 'SUBMITTED' ? '정정' : '작성'}`,
        actor: values.actor ?? values.reviewer, reason: values.correctionReason,
      },
    ],
  }
}

function evaluationLabel(type: EvaluationType) { return { SCREEN: '서류검토', INTERVIEW: '면접', FINAL: '처우협의' }[type] }

export interface StageTransitionOptions {
  actor?: Applicant['owner']
  overrideReason?: string
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
  const blockers = getStageTransitionBlockers(applicant, targetStage)
  if (blockers.length) throw new Error(blockers.join(' '))
  const transitionDate = getLocalDateString(transitionAt)
  const timeline = [
    ...(applicant.timeline ?? []),
    {
      id: `timeline-${applicant.id}-${(applicant.timeline ?? []).length + 1}`,
      at: transitionAt,
      fromStage: applicant.stage, toStage: targetStage, correction: options.correction,
      actor: options.actor, reason: options.overrideReason,
      rejectionReason: targetStage === 'REJECTED' ? options.rejectionReason : applicant.rejectionReason,
      rejectionMemo: targetStage === 'REJECTED' ? options.rejectionMemo : applicant.rejectionMemo,
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
          dueDate: targetSchedule?.date ?? transitionDate,
          reviewer: scheduleReviewer ?? applicant.owner ?? APPLICANT_OWNERS[0],
        },
      ]
    : applicant.evaluations
  const updated: Applicant = {
    ...applicant,
    stage: targetStage,
    nextAction,
    rejectionReason: targetStage === 'REJECTED' ? options.rejectionReason?.trim() : undefined,
    rejectionMemo: targetStage === 'REJECTED' ? options.rejectionMemo?.trim() || undefined : undefined,
    evaluations: evaluations?.map((evaluation) => ({ ...evaluation, active: evaluation.type === targetEvaluationType })),
    schedule: applicant.schedule ? { ...applicant.schedule, active: targetStage === 'INTERVIEW' } : applicant.schedule,
    dueDate: undefined,
    offer: applicant.offer && (applicant.stage === 'REJECTED' || !['OFFER', 'HIRED'].includes(targetStage)) ? { ...applicant.offer, active: false } : applicant.offer,
    employment: applicant.employment && targetStage !== 'HIRED' ? { ...applicant.employment, active: false } : applicant.employment,
    followUps: [...(applicant.followUps ?? []).map((task) => /^(result-|handoff-|lifecycle-result-)/.test(task.id) ? { ...task, active: false } : task),
      ...(targetStage === 'HIRED' ? [{ id: `result-${applicant.id}-${timeline.length}`, label: '결과 통보', dueDate: transitionDate, done: false }] : []),
      ...(targetStage === 'HIRED' ? [{ id: `handoff-${applicant.id}-${timeline.length}`, label: '입사 인계', dueDate: transitionDate, done: false }] : []),
    ],
    timeline,
  }
  return targetStage === 'REJECTED' ? retireRecruitmentWork(updated, transitionAt) : updated
}

export function getAllowedNextStages(currentStage: ApplicantStage) {
  return ALLOWED_NEXT_STAGES[currentStage]
}

export function canTransitionTo(currentStage: ApplicantStage, targetStage: ApplicantStage) {
  return getAllowedNextStages(currentStage).includes(targetStage)
}

export const EVALUATION_TYPE_LABELS = { SCREEN: '서류검토', INTERVIEW: '면접', FINAL: '처우협의' } as const
export const EVALUATION_STATUS_LABELS = { PENDING: '작성 필요', SUBMITTED: '작성 완료' } as const
