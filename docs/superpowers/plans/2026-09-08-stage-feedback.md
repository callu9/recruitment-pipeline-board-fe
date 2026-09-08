# Stage Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 채용 담당자가 현재 전형의 내부 피드백을 지원자 상세에서 작성하고 mock API에 저장해 새로고침 뒤에도 확인할 수 있게 한다.

**Architecture:** 기존 `ApplicantEvaluation`을 피드백 저장 단위로 재사용하고, stage와 평가 유형의 대응 및 평가 제출을 순수 domain 함수로 둔다. 별도 feedback PATCH는 성공 응답만 TanStack Query cache에 병합하며, 기존 stage mutation의 optimistic update와 rollback은 그대로 유지한다.

**Tech Stack:** React 19, TypeScript, TanStack Query, MSW, localStorage, Vitest, React Testing Library, CSS Modules

**Spec:** `docs/superpowers/specs/2026-09-08-service-flow-improvement-design.md`

## Global Constraints

- 이 계획은 `[stage-feedback]` 하나만 구현한다. 일정 등록, 상태 기반 primary action, 단계 전진 gate, 1,000명 모드 제거는 다음 scope다.
- 새 dependency, 전역 store, toast, route, 범용 form abstraction을 추가하지 않는다.
- 평가자, 0–100점 점수, trim 후 비어 있지 않은 코멘트를 필수로 받는다.
- 피드백 저장은 pessimistic하게 처리하고, 기존 단계 저장만 optimistic update를 유지한다.
- 모든 mock 요청은 기존 200–800ms 지연과 약 15% 실패 설정을 그대로 사용한다.
- 지원자 목록의 source of truth는 TanStack Query cache 하나다.
- API는 존재하지 않는 applicant/evaluation, 현재 stage와 맞지 않는 evaluation, 잘못된 reviewer/score/comment를 저장하지 않는다.
- 사용자 검증 전 `PROMPTS.md` 기록, staging, commit을 하지 않는다.
- 사용자 검증 뒤 `prompt-record`를 실행하고 staged diff를 보고한 다음, 명시적 커밋 요청을 기다린다.

---

### Task 1: 평가 domain 계약과 순수 transform

**Files:**
- Modify: `src/features/recruitment-board/model/applicant.types.ts`
- Modify: `src/features/recruitment-board/model/stages.ts`
- Test: `src/features/recruitment-board/model/stages.test.ts`

**Interfaces:**
- Consumes: 기존 `Applicant`, `ApplicantStage`, `ApplicantEvaluation`, `APPLICANT_OWNERS`, `applyStageTransition`.
- Produces: `SubmitApplicantFeedbackRequest`, `STAGE_EVALUATION_TYPES`, `getCurrentStageEvaluation(applicant)`, `submitApplicantEvaluation(applicant, evaluationId, values, submittedAt)`.

- [x] **Step 1: 평가 매핑·제출·다음 단계 평가 생성의 실패 테스트 작성**

`stages.test.ts`의 import에 새 helper를 추가하고 아래 테스트를 작성한다.

```ts
import {
  applyStageTransition,
  getCurrentStageEvaluation,
  submitApplicantEvaluation,
} from './stages'

test('maps the active stage to its evaluation and submits feedback without mutating the source', () => {
  const applicant = {
    id: 'applicant-1', name: '김민지', role: 'Frontend Developer' as const,
    appliedAt: '2026-08-01T09:00:00.000Z', stage: 'DOCUMENT_REVIEW' as const,
    email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3,
    skills: ['React'], note: '', owner: '김하나' as const,
    evaluations: [{
      id: 'screen-1', type: 'SCREEN' as const, status: 'PENDING' as const,
      dueDate: '2026-09-08', reviewer: '김하나' as const,
    }],
    timeline: [],
  }

  expect(getCurrentStageEvaluation(applicant)?.id).toBe('screen-1')

  const updated = submitApplicantEvaluation(applicant, 'screen-1', {
    reviewer: '이서준', score: 85, comment: '  고객 관점의 설명이 명확합니다.  ',
  }, '2026-09-08')

  expect(updated.evaluations?.[0]).toMatchObject({
    status: 'SUBMITTED', reviewer: '이서준', score: 85,
    comment: '고객 관점의 설명이 명확합니다.', submittedAt: '2026-09-08',
  })
  expect(updated.timeline?.at(-1)?.label).toBe('서류검토 피드백 작성')
  expect(applicant.evaluations?.[0]?.status).toBe('PENDING')
})

test('creates one pending evaluation when entering an active stage', () => {
  const applicant = {
    id: 'applicant-1', name: '김민지', role: 'Frontend Developer' as const,
    appliedAt: '2026-08-01T09:00:00.000Z', stage: 'DOCUMENT_REVIEW' as const,
    email: 'minji@example.com', phone: '010-0000-0001', experienceYears: 3,
    skills: ['React'], note: '', owner: '김하나' as const,
    evaluations: [{
      id: 'screen-1', type: 'SCREEN' as const, status: 'SUBMITTED' as const,
      dueDate: '2026-09-08', reviewer: '김하나' as const, score: 85,
      comment: '진행 가능', submittedAt: '2026-09-08',
    }],
    timeline: [],
  }

  const updated = applyStageTransition(applicant, 'INTERVIEW', '2026-09-08')

  expect(updated.evaluations?.filter(({ type }) => type === 'INTERVIEW')).toEqual([
    expect.objectContaining({ status: 'PENDING', reviewer: '김하나', dueDate: '2026-09-08' }),
  ])
})
```

- [x] **Step 2: focused test를 실행해 RED 확인**

Run:

```bash
npm run test -- src/features/recruitment-board/model/stages.test.ts
```

Expected: 새 export가 없어 TypeScript import 또는 assertion이 실패한다.

- [x] **Step 3: 타입과 stage-evaluation 매핑 추가**

`applicant.types.ts`에 작성일과 요청 타입을 추가하고 API 오류 code를 확장한다.

```ts
export interface ApplicantEvaluation {
  id: string
  type: EvaluationType
  status: EvaluationStatus
  dueDate: string
  reviewer: ApplicantOwner
  score?: number
  comment?: string
  submittedAt?: string
}

export interface SubmitApplicantFeedbackRequest {
  reviewer: ApplicantOwner
  score: number
  comment: string
}
```

`ApiErrorBody['code']` union에 `'INVALID_EVALUATION'`을 추가한다.

`stages.ts`에 전형 매핑과 현재 평가 lookup을 추가한다.

```ts
export const STAGE_EVALUATION_TYPES: Partial<Record<ApplicantStage, EvaluationType>> = {
  DOCUMENT_REVIEW: 'SCREEN',
  INTERVIEW: 'INTERVIEW',
  OFFER: 'FINAL',
}

export function getCurrentStageEvaluation(applicant: Applicant) {
  const type = STAGE_EVALUATION_TYPES[applicant.stage]
  return type ? applicant.evaluations?.find((evaluation) => evaluation.type === type) : undefined
}
```

- [x] **Step 4: 순수 feedback submit과 pending evaluation 생성을 구현**

`stages.ts`에 평가 제출 transform을 추가한다.

```ts
export function submitApplicantEvaluation(
  applicant: Applicant,
  evaluationId: string,
  values: SubmitApplicantFeedbackRequest,
  submittedAt: string,
): Applicant {
  const evaluation = applicant.evaluations?.find(({ id }) => id === evaluationId)
  if (!evaluation) return applicant

  return {
    ...applicant,
    evaluations: applicant.evaluations?.map((current) => current.id === evaluationId ? {
      ...current,
      status: 'SUBMITTED',
      reviewer: values.reviewer,
      score: values.score,
      comment: values.comment.trim(),
      submittedAt,
    } : current),
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
```

`applyStageTransition`에서 target stage의 평가 유형이 있고 같은 유형 평가가 없을 때만 pending 평가를 append한다. 현재 모델의 schedule은 면접 일정뿐이므로 target이 `INTERVIEW`일 때만 그 면접관과 날짜를 재사용한다. `OFFER` 평가는 applicant owner와 전이일을 사용하고, 다음 `[stage-scheduling]` scope에서 처우 일정 모델과 연결한다.

```ts
const targetEvaluationType = STAGE_EVALUATION_TYPES[targetStage]
const targetSchedule = targetStage === 'INTERVIEW' ? applicant.schedule : null
const scheduleReviewer = APPLICANT_OWNERS.find((owner) => owner === targetSchedule?.interviewer)
const evaluations = targetEvaluationType
  && !(applicant.evaluations ?? []).some(({ type }) => type === targetEvaluationType)
  ? [...(applicant.evaluations ?? []), {
      id: `evaluation-${applicant.id}-${targetEvaluationType.toLowerCase()}`,
      type: targetEvaluationType,
      status: 'PENDING' as const,
      dueDate: targetSchedule?.date ?? transitionAt,
      reviewer: scheduleReviewer ?? applicant.owner ?? APPLICANT_OWNERS[0],
    }]
  : applicant.evaluations
```

반환 객체에 `evaluations`를 포함하고 기존 stage, nextAction, rejection, timeline 규칙은 유지한다.

- [x] **Step 5: domain test GREEN 확인**

Run:

```bash
npm run test -- src/features/recruitment-board/model/stages.test.ts src/features/recruitment-board/model/applicantCache.test.ts
```

Expected: 두 파일의 모든 테스트가 통과하고 기존 optimistic cache transform도 새 evaluation을 포함한다.

---

### Task 2: feedback mock API와 localStorage 저장

**Files:**
- Modify: `src/mocks/mockDb.ts`
- Modify: `src/mocks/handlers.ts`
- Test: `src/mocks/mockDb.test.ts`
- Test: `src/mocks/handlers.test.ts`

**Interfaces:**
- Consumes: Task 1의 `SubmitApplicantFeedbackRequest`, `getCurrentStageEvaluation`, `submitApplicantEvaluation`.
- Produces: `updateApplicantEvaluation(applicantId, evaluationId, values, submittedAt?)`, `PATCH /api/applicants/:applicantId/evaluations/:evaluationId`.

- [x] **Step 1: DB entity-only 저장 테스트 작성**

`mockDb.test.ts` import에 `updateApplicantEvaluation`을 추가하고 아래 테스트를 작성한다.

```ts
test('updates one evaluation and leaves other applicants unchanged', () => {
  const applicants = createSeedApplicants(2)
  saveApplicants(applicants)
  const evaluation = applicants[0]?.evaluations?.[0]
  expect(evaluation).toBeDefined()

  const updated = updateApplicantEvaluation(applicants[0]!.id, evaluation!.id, {
    reviewer: '이서준', score: 91, comment: '기술 선택의 근거가 명확합니다.',
  }, '2026-09-08')

  expect(updated.evaluations?.[0]).toMatchObject({ status: 'SUBMITTED', score: 91 })
  expect(loadApplicants()[1]).toEqual(applicants[1])
})
```

- [x] **Step 2: feedback HTTP 계약의 성공·거부·실패 테스트 작성**

`handlers.test.ts`의 DB import를 `import { loadApplicants, saveApplicants, STORAGE_KEY } from './mockDb'`로 바꾸고 다음 세 시나리오를 추가한다.

```ts
test('submits the current-stage evaluation and persists it', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  const applicant = loadApplicants()[0]!
  const evaluation = applicant.evaluations!.find(({ type }) => type === 'SCREEN')!

  const response = await fetch(`${applicantsUrl}/${applicant.id}/evaluations/${evaluation.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer: '이서준', score: 88, comment: ' 진행 근거가 충분합니다. ' }),
  })

  expect(response.status).toBe(200)
  await expect(response.json()).resolves.toMatchObject({
    id: applicant.id,
    evaluations: expect.arrayContaining([expect.objectContaining({
      id: evaluation.id, status: 'SUBMITTED', reviewer: '이서준', score: 88,
      comment: '진행 근거가 충분합니다.',
    })]),
  })
  expect(loadApplicants()[0]?.evaluations?.find(({ id }) => id === evaluation.id)?.status).toBe('SUBMITTED')
})

test.each([
  ['empty comment', { reviewer: '김하나', score: 80, comment: '   ' }],
  ['low score', { reviewer: '김하나', score: -1, comment: '근거' }],
  ['high score', { reviewer: '김하나', score: 101, comment: '근거' }],
  ['unknown reviewer', { reviewer: '없는 담당자', score: 80, comment: '근거' }],
])('rejects %s without changing storage', async (_name, body) => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  const applicant = loadApplicants()[0]!
  const evaluation = applicant.evaluations![0]!
  const before = localStorage.getItem(STORAGE_KEY)

  const response = await fetch(`${applicantsUrl}/${applicant.id}/evaluations/${evaluation.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  expect(response.status).toBe(400)
  expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
})

test('does not persist feedback when the mock failure is forced', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  const applicant = loadApplicants()[0]!
  const evaluation = applicant.evaluations![0]!
  const before = localStorage.getItem(STORAGE_KEY)
  setMockApiTestConfig({ delayMs: 0, failureRate: 1 })

  const response = await fetch(`${applicantsUrl}/${applicant.id}/evaluations/${evaluation.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer: '김하나', score: 80, comment: '근거' }),
  })

  expect(response.status).toBe(503)
  expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
})
```

현재 stage와 다른 evaluation은 저장하지 않는 테스트를 추가한다.

```ts
test('rejects an evaluation from a different stage without changing storage', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  const applicants = loadApplicants()
  const applicant = applicants[0]!
  const otherEvaluation = {
    ...applicant.evaluations![0]!, id: 'interview-evaluation', type: 'INTERVIEW' as const,
  }
  saveApplicants(applicants.map((current) => current.id === applicant.id
    ? { ...current, evaluations: [...current.evaluations!, otherEvaluation] }
    : current))
  const before = localStorage.getItem(STORAGE_KEY)

  const response = await fetch(`${applicantsUrl}/${applicant.id}/evaluations/${otherEvaluation.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer: '김하나', score: 80, comment: '근거' }),
  })

  expect(response.status).toBe(409)
  await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_EVALUATION' })
  expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
})

test.each([
  ['applicant', `${applicantsUrl}/missing/evaluations/evaluation-1`],
  ['evaluation', `${applicantsUrl}/applicant-001/evaluations/missing`],
])('rejects a missing %s without changing storage', async (_name, url) => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  loadApplicants()
  const before = localStorage.getItem(STORAGE_KEY)

  const response = await fetch(url, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer: '김하나', score: 80, comment: '근거' }),
  })

  expect(response.status).toBe(404)
  await expect(response.json()).resolves.toMatchObject({ code: 'NOT_FOUND' })
  expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
})
```

- [x] **Step 3: focused tests를 실행해 RED 확인**

Run:

```bash
npm run test -- src/mocks/mockDb.test.ts src/mocks/handlers.test.ts
```

Expected: `updateApplicantEvaluation`과 feedback route가 없어 실패한다.

- [x] **Step 4: DB update를 최신 배열 한 건 교체로 구현**

`mockDb.ts`에 아래 함수를 추가한다.

```ts
export function updateApplicantEvaluation(
  applicantId: string,
  evaluationId: string,
  values: SubmitApplicantFeedbackRequest,
  submittedAt = getLocalDateString(),
): Applicant {
  const applicants = loadApplicants()
  const applicant = applicants.find(({ id }) => id === applicantId)
  if (!applicant) throw new Error(`Applicant not found: ${applicantId}`)

  const updatedApplicant = submitApplicantEvaluation(applicant, evaluationId, values, submittedAt)
  saveApplicants(applicants.map((current) => current.id === applicantId ? updatedApplicant : current))
  return updatedApplicant
}
```

handler가 evaluation 존재 여부를 먼저 검증하므로 이 함수는 대상 applicant 교체만 책임진다.

- [x] **Step 5: handler 입력 검증과 route 구현**

`handlers.ts`에 body guard를 추가한다.

```ts
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
}
```

route 처리 순서는 JSON parse → body 검증 → applicant lookup → evaluation lookup → 현재 stage evaluation 확인 → random failure → DB update다.

```ts
http.patch('*/api/applicants/:applicantId/evaluations/:evaluationId', async ({ params, request }) => {
  await waitForMockDelay()
  let body: unknown
  try { body = await request.json() } catch {
    return error(400, 'INVALID_BODY', '요청 본문이 올바른 JSON 객체가 아닙니다.')
  }
  if (!isFeedbackRequest(body)) return error(400, 'INVALID_BODY', '피드백 입력이 올바르지 않습니다.')

  const applicant = getApplicantSnapshot().find(({ id }) => id === params.applicantId)
  if (!applicant) return error(404, 'NOT_FOUND', '지원자를 찾을 수 없습니다.')
  const evaluation = applicant.evaluations?.find(({ id }) => id === params.evaluationId)
  if (!evaluation) return error(404, 'NOT_FOUND', '평가를 찾을 수 없습니다.')
  if (getCurrentStageEvaluation(applicant)?.id !== evaluation.id) {
    return error(409, 'INVALID_EVALUATION', '현재 전형의 평가만 작성할 수 있습니다.')
  }
  if (shouldMockApiFail()) return error(503, 'MOCK_FAILURE', '피드백을 저장하지 못했습니다.')

  return HttpResponse.json(updateApplicantEvaluation(applicant.id, evaluation.id, body))
})
```

- [x] **Step 6: mock tests GREEN 확인**

Run:

```bash
npm run test -- src/mocks/mockDb.test.ts src/mocks/handlers.test.ts
```

Expected: 기존 stage/positions 계약을 포함해 두 파일의 모든 테스트가 통과한다.

---

### Task 3: TanStack Query feedback mutation

**Files:**
- Create: `src/features/recruitment-board/api/useSubmitApplicantFeedback.ts`
- Test through: `src/App.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `SubmitApplicantFeedbackRequest`, 기존 `applicantsQueryKey`, `replaceApplicant`.
- Produces: `useSubmitApplicantFeedback({ onError, onSuccess })`가 반환하는 `submitFeedback(applicantId, evaluationId, values)`와 `pendingIds`.

**Execution note:** TDD의 production-code-before-test 금지 규칙에 따라 Task 4 Step 1–2를 먼저 실행해 UI RED를 확인한 뒤 이 Task를 구현했다.

- [x] **Step 1: 최소 feedback mutation hook 작성**

새 파일에 아래 구현을 작성한다.

```ts
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
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('피드백을 저장하지 못했습니다.')
  return response.json() as Promise<Applicant>
}

export function useSubmitApplicantFeedback({
  onError,
  onSuccess,
}: {
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
```

- [x] **Step 2: hook lint/type boundary 확인**

Run:

```bash
npm run lint
npm run build
```

Expected: 두 명령이 exit 0이고 새 hook의 타입 오류가 없다.

---

### Task 4: 상세 패널 feedback form과 상태 연결

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.module.css`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `getCurrentStageEvaluation`, Task 3의 `submitFeedback`과 `pendingIds`.
- Produces: 현재 전형 pending evaluation의 accessible form, 성공 상태, 입력 보존 실패 alert.

- [x] **Step 1: feedback 작성·실패·중복 submit의 UI 테스트 작성**

`App.test.tsx`에 아래 성공 테스트를 추가한다.

```ts
test('submits the current-stage feedback from the detail panel', async () => {
  setMockApiTestConfig({ delayMs: 0, failureRate: 0 })
  renderApp(createSeedApplicants(1))
  const table = await screen.findByRole('table', { name: '지원자 목록' })
  fireEvent.click(within(table).getByRole('button', { name: /지원자 상세 보기: 김민지/ }))

  const form = screen.getByRole('form', { name: '서류검토 피드백' })
  fireEvent.change(within(form).getByLabelText('점수'), { target: { value: '88' } })
  fireEvent.change(within(form).getByLabelText('코멘트'), { target: { value: '문제 해결 근거가 명확합니다.' } })
  fireEvent.click(within(form).getByRole('button', { name: '피드백 저장' }))

  expect(await screen.findByRole('status')).toHaveTextContent('피드백을 저장했습니다')
  expect(within(screen.getByRole('dialog', { name: /김민지/ })).getByText('문제 해결 근거가 명확합니다.')).toBeInTheDocument()
  expect(screen.queryByRole('form', { name: '서류검토 피드백' })).not.toBeInTheDocument()
})
```

실패 테스트는 feedback PATCH를 503으로 override하고 제출 뒤 다음을 확인한다.

```ts
expect(await screen.findByRole('alert')).toHaveTextContent('피드백을 저장하지 못했습니다')
expect(screen.getByLabelText('점수')).toHaveValue(88)
expect(screen.getByLabelText('코멘트')).toHaveValue('입력 유지 확인')
```

중복 submit 테스트는 지연된 Promise handler의 호출 수를 세고, 첫 click 직후 button disabled와 form `aria-busy="true"`, 두 번째 click 뒤 PATCH 1회를 확인한다.

- [x] **Step 2: App focused test를 실행해 RED 확인**

Run:

```bash
npm run test -- src/App.test.tsx
```

Expected: `서류검토 피드백` form과 입력 control이 없어 신규 테스트가 실패한다.

- [x] **Step 3: App 내부에 scope 전용 FeedbackForm 추가**

범용 form framework를 만들지 않고 `App.tsx`에 현재 scope 전용 component를 둔다.

```tsx
function FeedbackForm({ evaluation, isPending, error, onSubmit }: {
  evaluation: ApplicantEvaluation
  isPending: boolean
  error?: string
  onSubmit: (values: SubmitApplicantFeedbackRequest) => void
}) {
  const [reviewer, setReviewer] = useState<ApplicantOwner>(evaluation.reviewer)
  const [score, setScore] = useState(evaluation.score?.toString() ?? '')
  const [comment, setComment] = useState(evaluation.comment ?? '')

  return <form aria-label={`${stageLabelForEvaluation(evaluation.type)} 피드백`}
    aria-busy={isPending}
    onSubmit={(event) => {
      event.preventDefault()
      onSubmit({ reviewer, score: Number(score), comment })
    }}>
    <label>평가자<select value={reviewer} disabled={isPending}
      onChange={(event) => setReviewer(event.target.value as ApplicantOwner)}>
      {APPLICANT_OWNERS.map((owner) => <option key={owner}>{owner}</option>)}
    </select></label>
    <label>점수<input type="number" min="0" max="100" required value={score}
      disabled={isPending} onChange={(event) => setScore(event.target.value)} /></label>
    <label>코멘트<textarea required value={comment} disabled={isPending}
      onChange={(event) => setComment(event.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={isPending}>{isPending ? '저장 중' : '피드백 저장'}</button>
  </form>
}
```

`stageLabelForEvaluation`은 `SCREEN`, `INTERVIEW`, `FINAL`을 각각 `서류검토`, `면접`, `처우협의`로 바꾸는 한 개의 지역 함수로 둔다.

- [x] **Step 4: ApplicantDetail 평가 section에 form과 완료 내용을 연결**

`ApplicantDetail`에 `onSubmitFeedback`, `feedbackPending`, `feedbackError` props를 추가한다. `getCurrentStageEvaluation(applicant)`가 `PENDING`이면 form을 표시하고, 모든 `SUBMITTED` 평가에는 score, reviewer, submittedAt, comment를 표시한다.

```tsx
{evaluation.status === 'SUBMITTED' && evaluation.comment
  ? <p className={styles.evaluationComment}>{evaluation.comment}</p>
  : evaluation.id === currentEvaluation?.id
    ? <FeedbackForm
        evaluation={evaluation}
        isPending={feedbackPending}
        error={feedbackError}
        onSubmit={(values) => onSubmitFeedback(evaluation.id, values)}
      />
    : null}
```

기존 평가 pill, reviewer, dueDate 표시는 유지한다.

- [x] **Step 5: App에서 mutation과 사용자 feedback 연결**

`App`에 평가별 오류 상태를 추가한다.

```ts
const [feedbackSaveError, setFeedbackSaveError] = useState<{
  applicantId: string
  evaluationId: string
  message: string
} | null>(null)
```

hook callback은 실패 시 form 인근 오류를 설정하고 성공 시 같은 오류를 제거한 뒤 기존 전역 success 상태를 갱신한다.

```ts
const { submitFeedback, pendingIds: feedbackPendingIds } = useSubmitApplicantFeedback({
  onError: ({ applicantId, evaluationId }) => setFeedbackSaveError({
    applicantId, evaluationId, message: '피드백을 저장하지 못했습니다. 다시 시도해 주세요.',
  }),
  onSuccess: (applicant, { evaluationId }) => {
    setFeedbackSaveError((current) => current?.applicantId === applicant.id
      && current.evaluationId === evaluationId ? null : current)
    setFeedbackSuccess(`${applicant.name}님의 피드백을 저장했습니다.`)
  },
})
```

선택된 applicant의 `ApplicantDetail`에 submit callback, pending 여부, 현재 evaluation과 일치하는 오류만 전달한다.

- [x] **Step 6: form 스타일을 기존 detail token으로 최소 추가**

`App.module.css`에 기존 input/select/textarea와 같은 border, radius, focus style을 재사용하는 `.feedbackForm`, `.feedbackGrid`, `.evaluationComment`만 추가한다. 새 색상 token이나 animation은 만들지 않는다.

- [x] **Step 7: UI와 전체 회귀 테스트 GREEN 확인**

Run:

```bash
npm run test -- src/App.test.tsx src/features/recruitment-board/model/stages.test.ts src/mocks/handlers.test.ts src/mocks/mockDb.test.ts
npm run lint
npm run test
npm run build
git diff --check
```

Expected: 모든 명령이 exit 0이고 기존 stage 이동, rejection, correction, retry, rollback 테스트가 유지된다.

---

### Task 5: PRD·결정 기록과 unstaged candidate gate

**Files:**
- Modify: `docs/PRD.md`
- Modify: `DECISIONS.md`
- Do not modify yet: `PROMPTS.md`

**Interfaces:**
- Consumes: Task 1–4의 실제 최종 동작과 검증 결과.
- Produces: 현재 제품 기준의 `FR-12 전형별 내부 피드백`, 피드백 저장 결정, 사용자 검증용 unstaged candidate.

- [x] **Step 1: PRD 비목표와 요구사항을 실제 구현 계약으로 수정**

`docs/PRD.md`의 비목표에서 `평가 작성·승인` 전체를 제거하지 말고 승인만 비목표로 남긴다.

```md
- 여러 평가자의 독립 승인과 평가 승인 절차
```

`지원자 상세` 뒤에 다음 요구사항을 추가한다.

```md
### FR-12. 전형별 내부 피드백 — Must

활성 지원자의 현재 전형 평가를 상세 패널에서 작성할 수 있어야 한다.

수용 기준:

- 서류검토, 면접, 처우협의는 각각 SCREEN, INTERVIEW, FINAL 평가와 연결된다.
- 평가자, 0–100점 점수, 코멘트는 필수다.
- 현재 전형의 평가만 작성할 수 있다.
- 저장 성공 후 작성자, 점수, 코멘트, 작성일을 표시하고 타임라인에 기록한다.
- 저장 실패 시 기존 데이터와 입력값을 유지하고 다시 시도할 수 있다.
- 활성 단계 진입 시 해당 전형 평가가 없으면 pending 평가를 한 건 만든다.
```

API 표에 feedback PATCH를 추가하고, 현재 알려진 제한의 “평가를 편집할 수 없다” 문구를 일정·메모·포지션만 남도록 고친다.

- [x] **Step 2: DECISIONS에 feedback 저장 경계 기록**

`DECISIONS.md`에 다음 내용을 실제 구현과 일치하도록 추가한다.

```md
## D-015. 기존 평가 엔티티를 전형 피드백으로 사용한다

### 결정

- 별도 feedback 엔티티 없이 ApplicantEvaluation을 전형별 피드백으로 사용한다.
- 피드백은 API 성공 뒤 Query cache에 병합하고 stage 이동만 기존 optimistic update를 유지한다.
- 평가자, 점수, 코멘트와 작성일을 저장하고 타임라인에 작성 사실을 남긴다.

### 이유

- 현재 평가 상태와 새 피드백 저장소를 이중 관리하지 않는다.
- 작성 form 입력은 실패 뒤 그대로 유지하면서 저장되지 않은 평가가 다른 화면에 노출되는 일을 막는다.

### 남긴 범위

- 여러 평가자의 독립 제출, 승인, draft, 첨부 파일은 구현하지 않는다.
- 피드백과 일정에 따른 정상 전진 gate는 stage-scheduling scope에서 연결한다.
```

- [x] **Step 3: 최종 자동 검증 재실행**

Run:

```bash
npm run lint
npm run test
npm run build
git diff --check
git status --short
git diff --stat
```

Expected: lint/test/build/diff check가 통과하고 변경 파일은 `[stage-feedback]` 범위와 이 plan/spec 문서뿐이다.

- [x] **Step 4: unstaged candidate를 사용자에게 보고하고 중단**

다음을 실제 결과로 보고한다.

- 변경 파일
- focused/full test 수와 결과
- lint/build 결과와 기존 warning
- 충족한 FR-12 수용 기준
- 수행할 수동 브라우저 시나리오
- 여러 평가자 승인·draft·첨부를 제외한 이유
- AI 초안에서 기각하거나 재작성한 내용

사용자가 브라우저 검증 결과를 주거나 미검증 범위를 명시적으로 수용할 때까지 `PROMPTS.md`, staging, commit을 진행하지 않는다.

수동 브라우저 시나리오는 다음으로 고정한다.

1. 서류검토 지원자 상세에서 평가자·점수·코멘트를 저장하고 완료 내용과 타임라인을 확인한다.
2. 페이지를 새로고침한 뒤 같은 지원자의 작성자·점수·코멘트·작성일이 유지되는지 확인한다.
3. DevTools 또는 테스트 설정으로 feedback PATCH 실패를 만들고 오류, 입력값 유지, 재시도를 확인한다.
4. 저장 중 같은 지원자의 버튼이 비활성화되고 다른 지원자의 기존 단계 이동은 막히지 않는지 확인한다.
5. 키보드만으로 상세 열기, form 입력, 저장, 상세 닫기와 trigger focus 복귀를 확인한다.

- [x] **Step 5: 사용자 검증 뒤 prompt-record와 staging gate 수행**

사용자 validation gate가 통과하면 별도 요청 없이 `prompt-record`를 실행해 `[stage-feedback]`의 실제 프롬프트, 출력 요지, 검증 결과를 `PROMPTS.md`에 작성한다. 기록만 바뀐 뒤에는 prompt contract 검증과 `git diff --check`를 실행하고, 현재 scope 파일만 stage한다.

Run:

```bash
git diff --cached --check
git diff --cached --stat
git status --short
```

Expected: staged diff가 `[stage-feedback]` 코드·테스트·PRD·DECISIONS·PROMPTS와 승인된 spec/plan만 포함한다.

- [ ] **Step 6: 명시적 커밋 요청 뒤에만 커밋**

사용자가 staged diff를 검토하고 커밋을 명시적으로 요청한 경우에만 실행한다.

```bash
git commit -m "feat(stage-feedback): 전형별 내부 피드백 작성 흐름 추가"
```

커밋 후 다음 scope를 자동 시작하지 않는다. `[stage-scheduling]` 계획·구현 전 현재 scope가 안정됐는지 확인한다.
