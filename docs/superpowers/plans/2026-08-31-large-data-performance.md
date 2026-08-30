# 1,000건 대량 데이터 성능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 별도 1,000건 데이터 모드를 제공하고 검색 입력과 보드 스크롤이 FR-10의 측정 기준을 충족하게 한다.

**Architecture:** 기존 seed generator와 mock config를 재사용해 240건·1,000건 저장소를 격리한다. 검색 control은 즉시 상태를 사용하고, memoized board content는 deferred filter 결과가 바뀔 때만 렌더링한다. 실제 scroll trace가 layout·paint 병목을 보일 때만 native CSS offscreen rendering을 추가한다.

**Tech Stack:** React 19, TypeScript strict, Vite mode env, TanStack Query, MSW + localStorage, Vitest + React Testing Library, CSS Modules

**Spec:** `docs/superpowers/specs/2026-08-31-large-data-performance-design.md`

## Global Constraints

- 기능 scope는 `[large-data-performance]`, 연결 요구사항은 과제 §3 대량 데이터 성능과 PRD `FR-10`이다.
- 기본 240건과 `recruitment-pipeline-board:applicants:v1` 저장 키를 그대로 유지한다.
- 1,000건 모드는 별도 `recruitment-pipeline-board:applicants:v1:1000` 키를 사용한다.
- TanStack Query cache를 지원자 원본 목록의 단일 진실 공급원으로 유지한다.
- mutation, 엔티티 단위 rollback, 동일 ID pending guard, 단계 전이와 dialog focus·scroll 복귀를 변경하지 않는다.
- 새 dependency, debounce timer, 검색 index, 서버 pagination, 가상화 library를 추가하지 않는다.
- 성능 절대 시간을 CI assertion으로 만들지 않는다. 자동 테스트는 정확성, production trace는 응답성과 scroll을 검증한다.
- 프롬프트 기록, staging, commit은 이 계획의 실행 범위에서 제외한다.
- 구현 후 unstaged candidate와 수동 검증 시나리오를 보고하고 사용자 검증을 기다린다.

## File Map

| 파일 | 책임 |
|---|---|
| `.env.performance` | Vite performance mode에서 seed size 1,000 설정 |
| `package.json` | `dev:performance` 실행 명령 |
| `src/mocks/mockConfig.ts` | 240/1,000 seed size 해석과 테스트 override |
| `src/mocks/mockConfig.test.ts` | seed size 입력 경계와 Vite env 검증 |
| `src/mocks/mockDb.ts` | 활성 모드의 storage key·seed size 사용 |
| `src/mocks/mockDb.test.ts` | 두 저장소 격리, 1,000건 생성과 영속성 검증 |
| `src/mocks/seedApplicants.test.ts` | 1,000건 ID 고유성과 기존 생성 규칙 검증 |
| `src/features/recruitment-board/model/applicantSelectors.test.ts` | 1,000건 filter/group 정확성 검증 |
| `src/App.tsx` | deferred filter, memoized 계산과 board content 격리 |
| `src/App.test.tsx` | 즉시 control 값, 최종 filter 결과, busy 상태 회귀 검증 |
| `src/App.module.css` | trace에서 필요성이 확인된 경우에만 offscreen rendering 최적화 |
| `README.md` | 1,000건 실행과 production 측정 방법 |

---

### Task 1: 재현 가능한 1,000건 mock 저장소 모드

**Files:**
- Create: `.env.performance`
- Modify: `package.json`
- Modify: `src/mocks/mockConfig.ts`
- Modify: `src/mocks/mockConfig.test.ts`
- Modify: `src/mocks/mockDb.ts`
- Modify: `src/mocks/mockDb.test.ts`
- Modify: `src/mocks/seedApplicants.test.ts`

**Interfaces:**
- Consumes: `createSeedApplicants(size?: number): Applicant[]`, 기존 `setMockApiTestConfig`·`resetMockApiTestConfig`
- Produces: `ApplicantSeedSize`, `resolveApplicantSeedSize`, `getApplicantSeedSize`, `getApplicantsStorageKey`

- [ ] **Step 1: seed size 설정의 실패 테스트 작성**

`src/mocks/mockConfig.test.ts`의 import에 다음 이름을 추가한다.

```ts
import {
  DEFAULT_APPLICANT_SEED_SIZE,
  DEFAULT_FAILURE_RATE,
  PERFORMANCE_APPLICANT_SEED_SIZE,
  resolveApplicantSeedSize,
  resolveFailureRate,
} from './mockConfig'
```

같은 파일에 다음 테스트를 추가한다.

```ts
describe('resolveApplicantSeedSize', () => {
  test.each([
    [undefined, DEFAULT_APPLICANT_SEED_SIZE],
    ['240', DEFAULT_APPLICANT_SEED_SIZE],
    ['1000', PERFORMANCE_APPLICANT_SEED_SIZE],
    ['0', DEFAULT_APPLICANT_SEED_SIZE],
    ['invalid', DEFAULT_APPLICANT_SEED_SIZE],
  ])('normalizes %s to %s', (value, expected) => {
    expect(resolveApplicantSeedSize(value)).toBe(expected)
  })

  test('uses VITE_APPLICANT_SEED_SIZE after reloading the module', async () => {
    vi.stubEnv('VITE_APPLICANT_SEED_SIZE', '1000')
    vi.resetModules()

    const { getApplicantSeedSize } = await import('./mockConfig')

    expect(getApplicantSeedSize()).toBe(PERFORMANCE_APPLICANT_SEED_SIZE)
  })
})
```

- [ ] **Step 2: 설정 테스트가 실패하는지 확인**

Run:

```bash
npm run test -- src/mocks/mockConfig.test.ts
```

Expected: `DEFAULT_APPLICANT_SEED_SIZE`, `PERFORMANCE_APPLICANT_SEED_SIZE`, `resolveApplicantSeedSize` export가 없어 FAIL.

- [ ] **Step 3: seed size 설정 최소 구현**

`src/mocks/mockConfig.ts`의 failure-rate 상수 아래에 다음을 추가한다.

```ts
export const DEFAULT_APPLICANT_SEED_SIZE = 240
export const PERFORMANCE_APPLICANT_SEED_SIZE = 1000
export type ApplicantSeedSize =
  | typeof DEFAULT_APPLICANT_SEED_SIZE
  | typeof PERFORMANCE_APPLICANT_SEED_SIZE

export function resolveApplicantSeedSize(value: string | undefined): ApplicantSeedSize {
  return value === String(PERFORMANCE_APPLICANT_SEED_SIZE)
    ? PERFORMANCE_APPLICANT_SEED_SIZE
    : DEFAULT_APPLICANT_SEED_SIZE
}
```

browser 설정과 test override를 다음 형태로 확장한다.

```ts
const browserFailureRate = resolveFailureRate(import.meta.env.VITE_MOCK_FAILURE_RATE)
const browserApplicantSeedSize = resolveApplicantSeedSize(import.meta.env.VITE_APPLICANT_SEED_SIZE)

let testConfig: {
  delayMs?: number
  failureRate?: number
  applicantSeedSize?: ApplicantSeedSize
} = {}

export function setMockApiTestConfig(config: {
  delayMs?: number
  failureRate?: number
  applicantSeedSize?: ApplicantSeedSize
}) {
  testConfig = config
}

export function getApplicantSeedSize(): ApplicantSeedSize {
  return testConfig.applicantSeedSize ?? browserApplicantSeedSize
}
```

기존 `resetMockApiTestConfig`, delay, failure 함수는 변경하지 않는다.

- [ ] **Step 4: 설정 테스트 통과 확인**

Run:

```bash
npm run test -- src/mocks/mockConfig.test.ts
```

Expected: `mockConfig.test.ts` 전체 PASS.

- [ ] **Step 5: 모드별 저장소 실패 테스트 작성**

`src/mocks/mockDb.test.ts` import를 다음처럼 확장한다.

```ts
import type { Applicant } from '../features/recruitment-board/model/applicant.types'
import {
  resetMockApiTestConfig,
  setMockApiTestConfig,
} from './mockConfig'
import {
  STORAGE_KEY,
  getApplicantsStorageKey,
  loadApplicants,
  saveApplicants,
  updateApplicantStage,
} from './mockDb'
```

같은 파일의 fixture는 `saveApplicants` 입력 타입과 일치하게 명시한다.

```ts
const validApplicant: Applicant = {
  id: 'applicant-001',
  name: '지원자 001',
  role: 'Frontend Developer',
  appliedAt: '2026-08-01T09:00:00.000Z',
  stage: 'DOCUMENT_REVIEW',
  email: 'applicant1@example.com',
  phone: '010-1000-1000',
  experienceYears: 3,
  skills: ['React', 'TypeScript'],
  note: 'Frontend Developer 지원자',
}
```

`afterEach`에 `resetMockApiTestConfig()`를 추가하고 다음 테스트를 작성한다.

```ts
test('isolates the 1,000 applicant mode and preserves its stage updates', () => {
  saveApplicants([{ ...validApplicant, name: 'Default mode applicant' }])
  const defaultStorage = localStorage.getItem(STORAGE_KEY)

  setMockApiTestConfig({ applicantSeedSize: 1000 })
  const performanceApplicants = loadApplicants()
  const performanceStorageKey = getApplicantsStorageKey()

  expect(performanceStorageKey).toBe(`${STORAGE_KEY}:1000`)
  expect(performanceApplicants).toHaveLength(1000)
  expect(localStorage.getItem(STORAGE_KEY)).toBe(defaultStorage)

  updateApplicantStage('applicant-001', 'INTERVIEW')

  expect(loadApplicants().find(({ id }) => id === 'applicant-001')?.stage).toBe('INTERVIEW')
  expect(JSON.parse(localStorage.getItem(performanceStorageKey) ?? '[]')).toHaveLength(1000)
  expect(localStorage.getItem(STORAGE_KEY)).toBe(defaultStorage)
})
```

- [ ] **Step 6: 저장소 테스트가 실패하는지 확인**

Run:

```bash
npm run test -- src/mocks/mockDb.test.ts
```

Expected: `getApplicantsStorageKey` export 또는 `applicantSeedSize` test config가 없어 FAIL.

- [ ] **Step 7: 모드별 storage key와 seed size 구현**

`src/mocks/mockDb.ts`에 다음 import를 추가한다.

```ts
import {
  DEFAULT_APPLICANT_SEED_SIZE,
  getApplicantSeedSize,
  type ApplicantSeedSize,
} from './mockConfig'
```

기존 `STORAGE_KEY` 아래에 다음 함수를 추가한다.

```ts
export function getApplicantsStorageKey(
  size: ApplicantSeedSize = getApplicantSeedSize(),
) {
  return size === DEFAULT_APPLICANT_SEED_SIZE
    ? STORAGE_KEY
    : `${STORAGE_KEY}:${size}`
}
```

저장소 함수는 매 호출 시 활성 key와 size를 사용하도록 바꾼다.

```ts
function readStoredApplicants(): Applicant[] | null {
  const stored = localStorage.getItem(getApplicantsStorageKey())
  if (stored === null) return null

  try {
    const applicants: unknown = JSON.parse(stored)
    return Array.isArray(applicants) && applicants.every(isApplicant) ? applicants : null
  } catch {
    return null
  }
}

export function saveApplicants(applicants: Applicant[]) {
  localStorage.setItem(getApplicantsStorageKey(), JSON.stringify(applicants))
}

export function loadApplicants(): Applicant[] {
  const storageKey = getApplicantsStorageKey()
  const applicants = readStoredApplicants()
  if (applicants) return applicants
  if (localStorage.getItem(storageKey) !== null) console.warn('Resetting invalid applicant storage')
  return resetApplicants()
}

export function resetApplicants(size = getApplicantSeedSize()) {
  const applicants = createSeedApplicants(size)
  saveApplicants(applicants)
  return applicants
}
```

fallback seed가 240으로 돌아가지 않게 두 함수도 활성 size를 사용한다.

```ts
export function updateApplicantStage(applicantId: string, stage: ApplicantStage): Applicant {
  const applicants = readStoredApplicants() ?? createSeedApplicants(getApplicantSeedSize())
  const applicant = applicants.find(({ id }) => id === applicantId)
  if (!applicant) throw new Error(`Applicant not found: ${applicantId}`)

  const updatedApplicant = { ...applicant, stage }
  saveApplicants(applicants.map((current) =>
    current.id === applicantId ? updatedApplicant : current))
  return updatedApplicant
}

export function getApplicantSnapshot() {
  return readStoredApplicants() ?? createSeedApplicants(getApplicantSeedSize())
}
```

- [ ] **Step 8: 1,000건 seed 회귀 테스트 추가**

`src/mocks/seedApplicants.test.ts`에 다음 테스트를 추가한다.

```ts
test('creates 1,000 applicants with unique IDs', () => {
  const applicants = createSeedApplicants(1000)

  expect(applicants).toHaveLength(1000)
  expect(new Set(applicants.map(({ id }) => id))).toHaveLength(1000)
  expect(applicants[0]).toMatchObject({ id: 'applicant-001', stage: STAGES[0].code })
  expect(applicants[999]).toMatchObject({ id: 'applicant-1000' })
})
```

- [ ] **Step 9: Vite performance mode 추가**

`.env.performance`를 다음 내용으로 만든다.

```env
VITE_APPLICANT_SEED_SIZE=1000
```

`package.json` scripts에 다음 한 줄을 추가한다.

```json
"dev:performance": "vite --mode performance"
```

- [ ] **Step 10: Task 1 focused 검증**

Run:

```bash
npm run test -- src/mocks/mockConfig.test.ts src/mocks/mockDb.test.ts src/mocks/seedApplicants.test.ts
```

Expected: 세 파일 전체 PASS. `git diff --check`도 PASS해야 한다.

Run:

```bash
git diff --check
```

---

### Task 2: 1,000건 production baseline 측정

**Files:**
- No repository file changes

**Interfaces:**
- Consumes: Task 1의 `.env.performance`, `dev:performance`, 별도 1,000건 storage key
- Produces: 검색·스크롤 baseline 수치와 CSS 적용 여부 결정

- [ ] **Step 1: production performance build 생성**

Run:

```bash
npm run build -- --mode performance
```

Expected: TypeScript와 Vite build PASS. 기존 bundle-size warning은 FR-10 interaction trace의 실패로 분류하지 않는다.

- [ ] **Step 2: production preview 실행**

Run:

```bash
npm run preview
```

Expected: Vite preview URL이 출력되고 페이지의 결과 요약이 `전체 1000명 중 1000명 표시`를 보여 준다.

- [ ] **Step 3: 검색 baseline trace 기록**

Chrome DevTools Performance panel에서 이름 검색 input에 `Alex Kim Jordan Lee`를 연속 입력한다. candidate 보고에는 Chrome version, OS, CPU, viewport, input event main-thread p95, 마지막 입력부터 결과 commit까지의 ms, 50ms 이상 long task 수를 실제 값으로 기록한다.

판정 기준:

- input event p95 `< 50ms`
- 결과 commit `<= 200ms`
- 타이핑 중 50ms 이상 long task가 반복되지 않음

- [ ] **Step 4: scroll baseline trace 기록**

가장 긴 컬럼을 따라 5초간 세로 스크롤하고 board viewport를 좌우로 이동한다. candidate 보고에는 50ms 이상 long task 수, 지속적인 frame 정지 여부, scroll position jump 여부, 상세 dialog 종료 후 위치 복귀 결과를 실제 값으로 기록한다. trace 파일 자체는 저장소에 추가하지 않는다.

---

### Task 3: 검색 control과 보드 렌더링 분리

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/features/recruitment-board/model/applicantSelectors.test.ts`

**Interfaces:**
- Consumes: 기존 `filterApplicants`, `getApplicantRoles`, `groupApplicantsByStage`, `pendingIds`
- Produces: `ApplicantBoardContentProps`, memoized `ApplicantBoardContent`, deferred filter 결과

- [ ] **Step 1: 1,000건 selector 정확성 테스트 작성**

`src/features/recruitment-board/model/applicantSelectors.test.ts`에 `createSeedApplicants` import와 다음 테스트를 추가한다.

```ts
import { createSeedApplicants } from '../../../mocks/seedApplicants'

test('filters and groups 1,000 applicants without losing or duplicating results', () => {
  const source = createSeedApplicants(1000)
  const filtered = filterApplicants(source, {
    nameQuery: 'alex',
    role: 'Backend Developer',
  })
  const grouped = groupApplicantsByStage(filtered)

  expect(filtered.length).toBeGreaterThan(0)
  expect(filtered.every(({ name, role }) =>
    name.toLowerCase().includes('alex') && role === 'Backend Developer')).toBe(true)
  expect(Object.values(grouped).flat()).toEqual(filtered)
})
```

- [ ] **Step 2: deferred UI 계약의 실패 테스트 작성**

`src/App.test.tsx`에 `createSeedApplicants` import와 다음 테스트를 추가한다.

```ts
import { createSeedApplicants } from './mocks/seedApplicants'

test('keeps the filter control current and settles the board on the latest filter', async () => {
  server.use(http.get('*/api/applicants', () => HttpResponse.json(createSeedApplicants(20))))

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App />
    </QueryClientProvider>,
  )

  const board = await screen.findByRole('region', { name: '채용 단계 보드' })
  const input = screen.getByLabelText('이름 검색')

  expect(board).toHaveAttribute('aria-busy', 'false')
  fireEvent.change(input, { target: { value: 'Alex Kim' } })
  expect(input).toHaveValue('Alex Kim')

  await waitFor(() => {
    expect(screen.getByText('전체 20명 중 5명 표시')).toBeInTheDocument()
    expect(board).toHaveAttribute('aria-busy', 'false')
  })
})
```

- [ ] **Step 3: UI 테스트가 현재 구현에서 실패하는지 확인**

Run:

```bash
npm run test -- src/App.test.tsx src/features/recruitment-board/model/applicantSelectors.test.ts
```

Expected: selector 테스트는 PASS할 수 있지만 App 테스트는 board에 `aria-busy="false"`가 없어 FAIL.

- [ ] **Step 4: React import와 memoized board content interface 추가**

`src/App.tsx` import를 다음 이름을 포함하도록 확장한다.

```ts
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
```

`App` 위에 다음 props와 component shell을 추가한다.

```ts
interface ApplicantBoardContentProps {
  applicantsByStage: Record<ApplicantStage, Applicant[]>
  pendingIds: ReadonlySet<string>
  onOpenDetail: (applicantId: string, trigger: HTMLButtonElement) => void
  onConfirmRequest: (
    applicantId: string,
    targetStage: ApplicantStage,
    trigger: HTMLButtonElement,
  ) => void
}

const ApplicantBoardContent = memo(function ApplicantBoardContent({
  applicantsByStage,
  pendingIds,
  onOpenDetail,
  onConfirmRequest,
}: ApplicantBoardContentProps) {
  return (
    <div className={styles.board}>
      {STAGES.map((stage, index) => (
        <section
          key={stage.code}
          className={styles.column}
          data-stage={stage.code}
          aria-labelledby={`stage-${index}`}
        >
          <div className={styles.columnHeader}>
            <h2 id={`stage-${index}`}>{stage.label}</h2>
            <span className={styles.stageCount}>{applicantsByStage[stage.code].length}명</span>
          </div>
          <div className={styles.cardList}>
            {applicantsByStage[stage.code].length === 0 ? (
              <p className={styles.columnEmpty}>이 단계에는 지원자가 없습니다.</p>
            ) : applicantsByStage[stage.code].map((applicant) => (
              <article key={applicant.id} className={styles.card}>
                <h3>{applicant.name}</h3>
                <p className={styles.stageTag}>현재 단계: {stage.label}</p>
                <div className={styles.cardMetadata}>
                  <p><span>직무</span>{applicant.role}</p>
                  <p><span>지원일</span>{applicant.appliedAt.slice(0, 10).replaceAll('-', '.')}</p>
                </div>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    onClick={(event) => onOpenDetail(applicant.id, event.currentTarget)}
                  >
                    {applicant.name} 상세 열기
                  </button>
                  {getAllowedNextStages(applicant.stage).length > 0 ? (
                    <StageMoveForm
                      applicant={applicant}
                      isPending={pendingIds.has(applicant.id)}
                      onConfirmRequest={(targetStage, trigger) =>
                        onConfirmRequest(applicant.id, targetStage, trigger)
                      }
                    />
                  ) : <p>종료된 단계입니다.</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
})
```

- [ ] **Step 5: deferred filter와 memoized 계산 추가**

`App`의 직접 selector 호출을 다음으로 교체한다.

```ts
const filters = useMemo(() => ({ nameQuery, role }), [nameQuery, role])
const deferredFilters = useDeferredValue(filters)
const isFiltering = filters !== deferredFilters
const roles = useMemo(() => getApplicantRoles(applicants), [applicants])
const filteredApplicants = useMemo(
  () => filterApplicants(applicants, deferredFilters),
  [applicants, deferredFilters],
)
const applicantsByStage = useMemo(
  () => groupApplicantsByStage(filteredApplicants),
  [filteredApplicants],
)
```

`selectedApplicant`와 `confirmationApplicant` lookup은 1,000건에서 단일 `find`이고 input의 main 병목이 아니므로 별도 index를 만들지 않는다.

- [ ] **Step 6: stable callback과 가벼운 viewport wrapper 연결**

`App`에 다음 callback을 추가한다.

```ts
const openApplicantDetail = useCallback((applicantId: string, trigger: HTMLButtonElement) => {
  const board = boardViewportRef.current
  if (board) detailScrollPositionRef.current = { left: board.scrollLeft, top: board.scrollTop }
  detailTriggerRef.current = trigger
  setSelectedApplicantId(applicantId)
}, [])

const requestStageChangeConfirmation = useCallback((
  applicantId: string,
  targetStage: ApplicantStage,
  trigger: HTMLButtonElement,
) => {
  confirmationTriggerRef.current = trigger
  setStageChangeConfirmation({ applicantId, targetStage })
}, [])
```

기존 board branch를 다음으로 교체한다.

```tsx
<div
  ref={boardViewportRef}
  className={styles.boardViewport}
  role="region"
  aria-label="채용 단계 보드"
  aria-busy={isFiltering}
  tabIndex={0}
>
  <ApplicantBoardContent
    applicantsByStage={applicantsByStage}
    pendingIds={pendingIds}
    onOpenDetail={openApplicantDetail}
    onConfirmRequest={requestStageChangeConfirmation}
  />
</div>
```

viewport wrapper는 input render 때 `aria-busy`만 갱신한다. memoized `ApplicantBoardContent`는 deferred grouped result가 바뀌기 전까지 card JSX를 다시 만들지 않는다.

- [ ] **Step 7: focused 테스트 통과 확인**

Run:

```bash
npm run test -- src/App.test.tsx src/features/recruitment-board/model/applicantSelectors.test.ts
```

Expected: 두 파일 전체 PASS. 기존 filter 초기화, detail focus·scroll 복귀, move dialog 테스트도 함께 PASS.

---

### Task 4: 최적화 후 측정과 조건부 native rendering

**Files:**
- Modify only if the scroll gate fails: `src/App.module.css`

**Interfaces:**
- Consumes: Task 2 baseline, Task 3 memoized board content
- Produces: FR-10 전후 trace 판정 또는 별도 `[column-virtualization]` 중단 근거

- [ ] **Step 1: Task 3 production build 재측정**

Run:

```bash
npm run build -- --mode performance
npm run preview
```

Task 2와 동일한 검색·스크롤 시나리오와 같은 환경을 사용한다. 검색 목표가 실패하면 `ApplicantBoardContent` props가 input render마다 새 참조가 되는지 React Profiler로 확인하고, 원인 참조 하나만 안정화한다. 임의 debounce는 추가하지 않는다.

- [ ] **Step 2: CSS 적용 gate 판정**

다음 조건을 모두 만족하면 CSS를 변경하지 않고 Step 4로 이동한다.

- scroll 중 50ms 이상 long task가 반복되지 않음
- 지속적인 frame 정지 없음
- scroll position jump 없음

하나라도 실패하고 trace의 layout·paint가 원인이면 Step 3을 수행한다. JavaScript 실행이 원인이면 `content-visibility`를 추가하지 않고 원인 callback·render를 Task 3 범위에서 최소 수정한다.

- [ ] **Step 3: native offscreen rendering 적용**

`src/App.module.css`의 기존 `.card` rule에 다음 두 선언을 추가한다.

```css
content-visibility: auto;
contain-intrinsic-size: auto 18rem;
```

새 scroll container, 높이 측정 JavaScript, virtualization dependency는 추가하지 않는다.

- [ ] **Step 4: 검색·스크롤·접근성 재검증**

다음을 실제 브라우저에서 확인한다.

1. 검색 input event p95 `< 50ms`
2. 마지막 입력 뒤 결과 commit `<= 200ms`
3. scroll 중 반복 long task·frame 정지·position jump 없음
4. 검색으로 이전 offscreen 카드를 결과에 표시한 뒤 상세 열기 가능
5. Tab으로 상세 button과 stage select·move button 접근 가능
6. 상세 dialog 닫기·Esc 뒤 trigger focus와 board scroll 위치 복귀

native CSS 뒤에도 목표가 실패하면 가상화 library를 이 scope에 추가하지 않는다. candidate 보고에 실패 trace 원인과 `[column-virtualization]` 분리 필요성을 기록한다.

---

### Task 5: 실행 문서와 unstaged candidate 검증

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1의 scripts·storage mode, Task 4의 확정 측정 절차
- Produces: 사용자 실행 방법과 최종 unstaged candidate 보고

- [ ] **Step 1: README에 1,000건 실행 방법 추가**

`README.md`의 실행 절 아래에 다음 섹션을 추가한다.

````md
## 1,000건 성능 모드

기본 240건과 별도 localStorage를 사용하는 1,000건 모드는 다음 명령으로 실행합니다.

```bash
npm run dev:performance
```

production build에서 측정하려면 다음 순서로 실행합니다.

```bash
npm run build -- --mode performance
npm run preview
```

기본 모드와 성능 모드의 성공한 단계 이동은 각각의 저장소에 유지됩니다.
````

- [ ] **Step 2: focused 자동 검증 실행**

Run:

```bash
npm run test -- src/mocks/mockConfig.test.ts src/mocks/mockDb.test.ts src/mocks/seedApplicants.test.ts src/features/recruitment-board/model/applicantSelectors.test.ts src/App.test.tsx
```

Expected: focused 파일 전체 PASS.

- [ ] **Step 3: 프로젝트 필수 전체 검증 실행**

Run:

```bash
npm run lint
npm run test
npm run build
git diff --check
```

Expected: 네 명령 모두 exit code 0. 성능 mode도 별도로 build한다.

Run:

```bash
npm run build -- --mode performance
```

Expected: exit code 0.

- [ ] **Step 4: scope diff 확인**

Run:

```bash
git status --short
git diff --stat
git diff -- .env.performance package.json README.md src/App.tsx src/App.module.css src/App.test.tsx src/mocks/mockConfig.ts src/mocks/mockConfig.test.ts src/mocks/mockDb.ts src/mocks/mockDb.test.ts src/mocks/seedApplicants.test.ts src/features/recruitment-board/model/applicantSelectors.test.ts
```

Expected: `[large-data-performance]` 파일만 변경되고 dependency, lockfile, Query/mutation hook, stage transition 파일은 변경되지 않는다.

- [ ] **Step 5: unstaged candidate 보고 후 중단**

다음 항목을 실제 결과로 보고한다.

```text
변경 파일
focused/full 명령과 실제 결과
기본 240건·1,000건 모드 재현 결과
검색 baseline/after 수치
scroll baseline/after 수치
CSS content-visibility 채택 또는 불채택 근거
FR-10 충족 여부
기존 Must·FR-08·FR-11 회귀 결과
수동 브라우저 검증 시나리오와 수행 결과
알려진 제한
기각하거나 다시 작성한 AI 제안과 이유
```

프롬프트 기록, staging, commit을 실행하지 않는다. 사용자 검증 결과 또는 추가 지시를 기다린다.
