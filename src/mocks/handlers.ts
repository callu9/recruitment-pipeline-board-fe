import { http, HttpResponse } from 'msw'
import { STAGES } from '../features/recruitment-board/model/stages'
import type { ApiErrorBody, MoveApplicantStageRequest } from '../features/recruitment-board/model/applicant.types'
import { getApplicantSnapshot, loadApplicants, updateApplicantStage } from './mockDb'
import { shouldMockApiFail, waitForMockDelay } from './mockConfig'

function error(status: number, code: ApiErrorBody['code'], message: string) {
  return HttpResponse.json<ApiErrorBody>({ code, message }, { status })
}

function isMoveRequest(value: unknown): value is MoveApplicantStageRequest {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isStage(value: unknown): value is MoveApplicantStageRequest['stage'] {
  return typeof value === 'string' && STAGES.some(({ code }) => code === value)
}

export const handlers = [
  http.get('*/api/applicants', async () => {
    await waitForMockDelay()
    if (shouldMockApiFail()) return error(503, 'MOCK_FAILURE', '지원자 목록을 불러오지 못했습니다.')

    return HttpResponse.json(loadApplicants())
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
    if (!getApplicantSnapshot().some(({ id }) => id === params.applicantId)) {
      return error(404, 'NOT_FOUND', '지원자를 찾을 수 없습니다.')
    }

    if (shouldMockApiFail()) return error(503, 'MOCK_FAILURE', '지원자 단계를 저장하지 못했습니다.')

    return HttpResponse.json(updateApplicantStage(params.applicantId as string, body.stage))
  }),
]
