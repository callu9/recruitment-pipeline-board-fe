import { getTransitionIssues } from '../features/recruitment-board/model/operations'
import { http, HttpResponse } from 'msw'
import { canTransitionTo, getLocalDateString, STAGES } from '../features/recruitment-board/model/stages'
import { APPLICANT_OWNERS, type ApiErrorBody, type ApplicantOwner, type MoveApplicantStageRequest, type SubmitApplicantFeedbackRequest } from '../features/recruitment-board/model/applicant.types'
import { getApplicantSnapshot, loadApplicants, loadPositions, updateApplicantEvaluation, updateApplicantStage, updateApplicantOperation, createApplicants, savePosition } from './mockDb'
import { shouldMockApiFail, waitForMockDelay } from './mockConfig'

function error(status: number, code: ApiErrorBody['code'], message: string) {
  return HttpResponse.json<ApiErrorBody>({ code, message }, { status })
}

function mutationError(cause: unknown) {
  if (cause instanceof DOMException && ['QuotaExceededError', 'SecurityError'].includes(cause.name)) return error(503, 'MOCK_FAILURE', '브라우저 저장 공간을 확인하고 다시 시도해 주세요.')
  return error(400, 'INVALID_BODY', cause instanceof Error ? cause.message : '입력을 확인해 주세요.')
}

function isMoveRequest(value: unknown): value is MoveApplicantStageRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const body = value as Record<string, unknown>
  return (body.transitionAt === undefined || (typeof body.transitionAt === 'string' && /^\d{4}-\d{2}-\d{2}(T.+)?$/.test(body.transitionAt) && !Number.isNaN(Date.parse(body.transitionAt))))
    && (body.correction === undefined || typeof body.correction === 'boolean')
    && (body.rejectionReason === undefined || typeof body.rejectionReason === 'string')
    && (body.actor === undefined || APPLICANT_OWNERS.includes(body.actor as ApplicantOwner))
    && (body.overrideReason === undefined || typeof body.overrideReason === 'string')
    && (body.rejectionMemo === undefined || typeof body.rejectionMemo === 'string')
}

function isStage(value: unknown): value is MoveApplicantStageRequest['stage'] {
  return typeof value === 'string' && STAGES.some(({ code }) => code === value)
}

function isFeedbackRequest(value: unknown): value is SubmitApplicantFeedbackRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const body = value as Record<string, unknown>
  return APPLICANT_OWNERS.includes(body.reviewer as ApplicantOwner)
    && typeof body.score === 'number'
    && Number.isFinite(body.score)
    && body.score >= 0
    && body.score <= 100
    && typeof body.comment === 'string'
    && Boolean(body.comment.trim())
    && (body.correctionReason === undefined || typeof body.correctionReason === 'string')
}

export const handlers = [
  http.post('*/api/applicants', async ({ request }) => {
    await waitForMockDelay()
    try {
      const body = await request.json() as { inputs: Parameters<typeof createApplicants>[0]; actor: ApplicantOwner }
      if (!APPLICANT_OWNERS.includes(body?.actor)) return error(400, 'INVALID_BODY', '처리자를 선택해 주세요.')
      if (shouldMockApiFail()) return error(503, 'MOCK_FAILURE', '접수를 저장하지 못했습니다.')
      return HttpResponse.json(createApplicants(body.inputs, body.actor), { status: 201 })
    } catch (cause) { return mutationError(cause) }
  }),
  http.post('*/api/positions', async ({ request }) => {
    await waitForMockDelay()
    try {
      const body = await request.json() as Parameters<typeof savePosition>[0]
      if (shouldMockApiFail()) return error(503, 'MOCK_FAILURE', '포지션을 저장하지 못했습니다.')
      return HttpResponse.json(savePosition(body))
    } catch (cause) { return mutationError(cause) }
  }),
  http.patch('*/api/applicants/:applicantId/operations', async ({ params, request }) => {
    await waitForMockDelay()
    try {
      const body = await request.json() as { operation: Parameters<typeof updateApplicantOperation>[1]; actor: ApplicantOwner }
      if (!APPLICANT_OWNERS.includes(body?.actor)) return error(400, 'INVALID_BODY', '처리자를 선택해 주세요.')
      if (!getApplicantSnapshot().some(({ id }) => id === params.applicantId)) return error(404, 'NOT_FOUND', '지원자를 찾을 수 없습니다.')
      if (shouldMockApiFail()) return error(503, 'MOCK_FAILURE', '작업을 저장하지 못했습니다.')
      return HttpResponse.json(updateApplicantOperation(params.applicantId as string, body.operation, body.actor))
    } catch (cause) { return mutationError(cause) }
  }),
  http.get('*/api/applicants', async () => {
    await waitForMockDelay()
    if (shouldMockApiFail()) return error(503, 'MOCK_FAILURE', '지원자 목록을 불러오지 못했습니다.')

    return HttpResponse.json(loadApplicants())
  }),

  http.get('*/api/positions', async () => {
    await waitForMockDelay()
    if (shouldMockApiFail()) return error(503, 'MOCK_FAILURE', '포지션 정보를 불러오지 못했습니다.')
    return HttpResponse.json(loadPositions())
  }),

  http.patch('*/api/applicants/:applicantId/stage', async ({ params, request }) => {
    await waitForMockDelay()

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return error(400, 'INVALID_BODY', '요청 본문이 올바른 JSON 객체가 아닙니다.')
    }

    if (!isMoveRequest(body)) return error(400, 'INVALID_BODY', '요청 본문이 올바른 JSON 객체가 아닙니다.')
    if (!isStage(body.stage)) return error(400, 'INVALID_STAGE', '유효하지 않은 채용 단계입니다.')
    const applicant = getApplicantSnapshot().find(({ id }) => id === params.applicantId)
    if (!applicant) {
      return error(404, 'NOT_FOUND', '지원자를 찾을 수 없습니다.')
    }
    if (body.stage === applicant.stage) return error(409, 'INVALID_TRANSITION', '현재 단계와 다른 단계를 선택해 주세요.')
    if (!body.correction && !canTransitionTo(applicant.stage, body.stage)) {
      return error(409, 'INVALID_TRANSITION', '현재 단계에서는 선택한 단계로 이동할 수 없습니다.')
    }
    const issues = getTransitionIssues(applicant, body.stage, loadPositions())
    if (issues.blockers.length || (!body.correction && issues.warnings.length && !body.overrideReason?.trim())) return error(409, 'INVALID_TRANSITION', [...issues.blockers, ...issues.warnings].join(' '))
    if (body.stage === 'REJECTED' && !body.rejectionReason?.trim()) {
      return error(400, 'INVALID_BODY', '불합격 사유를 입력해 주세요.')
    }

    if (shouldMockApiFail()) return error(503, 'MOCK_FAILURE', '지원자 단계를 저장하지 못했습니다.')

    try { return HttpResponse.json(updateApplicantStage(params.applicantId as string, body.stage, body.transitionAt ?? getLocalDateString(), {
      correction: body.correction, actor: body.actor, overrideReason: body.overrideReason,
      rejectionReason: body.rejectionReason,
      rejectionMemo: body.rejectionMemo,
    })) } catch { return error(503, 'MOCK_FAILURE', '단계를 저장하지 못했습니다. 저장 공간을 확인하고 다시 시도해 주세요.') }
  }),

  http.patch('*/api/applicants/:applicantId/evaluations/:evaluationId', async ({ params, request }) => {
    await waitForMockDelay()

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return error(400, 'INVALID_BODY', '요청 본문이 올바른 JSON 객체가 아닙니다.')
    }

    if (!isFeedbackRequest(body)) return error(400, 'INVALID_BODY', '피드백 입력이 올바르지 않습니다.')
    const applicant = getApplicantSnapshot().find(({ id }) => id === params.applicantId)
    if (!applicant) return error(404, 'NOT_FOUND', '지원자를 찾을 수 없습니다.')
    const evaluation = applicant.evaluations?.find(({ id }) => id === params.evaluationId)
    if (!evaluation) return error(404, 'NOT_FOUND', '평가를 찾을 수 없습니다.')
    if (evaluation.status === 'SUBMITTED' && !body.correctionReason?.trim()) return error(409, 'INVALID_EVALUATION', '제출 평가 정정에는 사유가 필요합니다.')
    if (shouldMockApiFail()) return error(503, 'MOCK_FAILURE', '피드백을 저장하지 못했습니다.')

    try { return HttpResponse.json(updateApplicantEvaluation(applicant.id, evaluation.id, body)) } catch { return error(503, 'MOCK_FAILURE', '평가를 저장하지 못했습니다. 다시 시도해 주세요.') }
  }),
]
