# 1,000건 대량 데이터 성능 설계

## 1. 범위

- 기능 scope: `[large-data-performance]`
- 연결 요구사항: 과제 §3 대량 데이터 성능, PRD `FR-10`
- 목표: 1,000건 데이터 모드에서 검색 입력과 보드 스크롤이 부드럽게 동작하도록 한다.
- 전제: 기존 Must 기능과 `FR-08`, `FR-11`의 동시성·접근성 계약을 바꾸지 않는다.

프롬프트 기록, staging, commit은 이 작업에서 다루지 않는다.

## 2. 현재 구조와 병목 후보

현재 `src/App.tsx`는 검색어가 바뀔 때마다 다음 작업을 모두 다시 수행한다.

1. 직무 목록 계산
2. 전체 지원자 필터링
3. 필터 결과의 단계별 그룹화
4. 다섯 컬럼과 모든 카드 JSX 생성

기본 seed 생성기인 `createSeedApplicants(size)`는 이미 1,000건 생성을 지원하지만, 실행 모드는 항상 240건을 기본값으로 사용한다. `cardList`는 모든 카드를 한 번에 렌더링하며 렌더링 범위를 제한하는 CSS도 없다.

따라서 계산량보다 검색 input과 전체 카드 렌더링이 같은 React render에 묶여 있다는 점, 그리고 1,000개 카드의 layout·paint가 우선 측정 대상이다.

## 3. 검토한 접근

### A. 측정 후 React·브라우저 내장 기능 적용 — 채택

- 1,000건 실행 모드를 먼저 만든다.
- `useDeferredValue`, `useMemo`, `memo`로 입력 갱신과 보드 렌더링을 분리한다.
- 스크롤 trace에서 layout·paint 병목이 확인될 때만 `content-visibility`를 적용한다.
- 새 dependency가 없고 기존 DOM·키보드 경로를 유지한다.

### B. 즉시 컬럼별 가상 스크롤 도입 — 보류

- DOM 수를 가장 강하게 제한할 수 있다.
- 현재 설치되지 않은 가상화 dependency, 고정 높이의 다섯 scroll container, 가변 높이 카드 측정이 필요하다.
- 상세 dialog focus 복귀와 키보드 탐색 회귀 위험이 크므로 측정 전에는 비용을 정당화할 수 없다.

### C. selector 메모이제이션만 적용 — 기각

- 변경량은 가장 작다.
- 동일한 필터 값의 재계산은 줄이지만, input 갱신 때 1,000개 카드 JSX를 다시 만드는 문제는 남는다.
- `FR-10`의 입력 응답성 근거로 부족하다.

## 4. 설계

### 4.1 재현 가능한 1,000건 모드

`src/mocks/mockConfig.ts`에 다음 설정을 둔다.

```ts
export const DEFAULT_APPLICANT_SEED_SIZE = 240
export const PERFORMANCE_APPLICANT_SEED_SIZE = 1000

export function resolveApplicantSeedSize(value: string | undefined): 240 | 1000
export function getApplicantSeedSize(): 240 | 1000
```

`resolveApplicantSeedSize`는 문자열 `"1000"`만 성능 모드로 인정하고 나머지는 240으로 되돌린다. 임의 크기를 지원하는 설정 계층은 만들지 않는다. 테스트에서는 기존 `setMockApiTestConfig`의 선택 필드로 seed size를 주입한다.

`.env.performance`는 다음 값만 가진다.

```env
VITE_APPLICANT_SEED_SIZE=1000
```

`package.json`에는 `vite --mode performance`를 실행하는 `dev:performance` script를 추가한다. production trace는 다음 순서로 실행한다.

```bash
npm run build -- --mode performance
npm run preview
```

기본 240건은 기존 `recruitment-pipeline-board:applicants:v1` 키를 그대로 사용한다. 1,000건 모드는 `recruitment-pipeline-board:applicants:v1:1000` 키를 사용한다. 두 모드를 분리해 기존 데이터를 삭제하지 않고, 각 모드의 성공한 단계 이동은 새로고침 뒤에도 유지한다.

### 4.2 필터 계산

`App`은 즉시 입력 값인 `nameQuery`, `role`과 목록에 반영할 deferred filter를 구분한다.

```ts
const filters = useMemo(() => ({ nameQuery, role }), [nameQuery, role])
const deferredFilters = useDeferredValue(filters)

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

검색 input과 직무 select는 즉시 갱신된다. 결과 count와 실제 컬럼 목록은 같은 deferred 결과를 사용해 서로 모순되지 않게 한다. deferred 결과가 이전 필터를 표시하는 짧은 구간에는 보드에 `aria-busy="true"`를 제공한다.

### 4.3 보드 렌더링 격리

board viewport wrapper는 `App`에 남겨 `aria-busy`와 기존 scroll ref를 즉시 갱신한다. 그 안의 다섯 컬럼과 카드 목록만 `src/App.tsx` 안의 `memo` 컴포넌트로 분리한다. 별도 파일이나 범용 Card·Column abstraction은 만들지 않는다.

컴포넌트가 받는 값은 다음으로 제한한다.

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
```

`boardViewportRef`는 기존 상세 dialog 종료 시 scroll 위치 복귀 계약을 유지하기 위해 부모가 계속 소유한다. 두 callback은 `useCallback`으로 참조를 유지한다. 즉시 input render에서는 deferred filter, grouped result, `pendingIds`, callback이 모두 같으므로 memoized board content를 다시 렌더링하지 않는다. 부모의 가벼운 viewport wrapper만 `aria-busy`를 갱신하고, deferred filter가 바뀌면 board content가 새 결과를 렌더링한다.

TanStack Query cache는 계속 지원자 원본의 단일 진실 공급원이다. 이동 mutation, 엔티티 단위 rollback, 동일 지원자 pending guard는 변경하지 않는다.

### 4.4 스크롤 렌더링

production baseline trace에서 1,000개 카드의 layout·paint가 스크롤 병목으로 확인된 경우에만 다음 CSS를 카드에 적용한다.

```css
.card {
  content-visibility: auto;
  contain-intrinsic-size: auto 18rem;
}
```

값은 현재 카드의 보수적인 예상 높이로 시작하고, 실제 scroll jump가 있으면 측정한 대표 카드 높이로 한 번만 조정한다. 별도의 카드 높이 측정 JavaScript는 추가하지 않는다.

이 방식은 DOM과 semantic HTML을 유지하면서 offscreen layout·paint를 브라우저에 맡긴다. 적용 뒤 상세 열기, 단계 이동, Tab 순서, 검색으로 offscreen 카드가 결과 상단에 나타나는 경로를 다시 확인한다.

native CSS 적용 뒤에도 아래 측정 기준을 충족하지 못하면 현재 scope를 확장하지 않는다. 실패 trace를 근거로 별도 `[column-virtualization]` scope를 설계하고 그때만 가상화 dependency를 검토한다.

## 5. 측정 계약

성능 판정은 production build에서 수행한다. 측정 시 브라우저 버전, OS·CPU, viewport와 trace 파일명을 기록해 동일 환경의 전후 결과만 비교한다.

공통 조건:

- 데이터 1,000건
- mock GET 성공 뒤 보드가 모두 표시된 상태
- Chrome DevTools Performance panel 사용
- React development mode와 jsdom 실행 시간은 성능 근거로 사용하지 않음

검색 시나리오:

1. 이름 검색 input에 `Alex Kim Jordan Lee`를 연속 입력한다.
2. input 값이 키 입력과 함께 갱신되는지 확인한다.
3. 마지막 입력 뒤 결과 count와 카드 목록이 함께 갱신되는지 확인한다.
4. 같은 시나리오를 직무 filter와 필터 초기화에도 수행한다.

목표:

- 입력 event의 main-thread 처리 p95가 50ms 미만
- 마지막 입력 뒤 필터 결과 commit이 200ms 이내
- 타이핑 중 50ms 이상 long task가 반복되지 않음

스크롤 시나리오:

1. 가장 긴 컬럼을 따라 5초 동안 연속 세로 스크롤한다.
2. board viewport를 좌우로 이동해 다섯 컬럼을 확인한다.
3. 스크롤 뒤 상세 dialog를 열고 닫아 원래 위치 복귀를 확인한다.

목표:

- 연속 스크롤 중 50ms 이상 long task가 반복되지 않음
- 지속적인 프레임 정지나 scroll position jump가 없음
- 상세 dialog 종료 후 기존 scroll 위치가 유지됨

절대 시간은 CI assertion으로 두지 않는다. 하드웨어와 runner 부하에 따라 flaky해지므로 자동 테스트는 데이터 크기와 동작 정확성만 검증하고, 응답성과 스크롤은 전후 trace로 검증한다.

## 6. 자동 검증

### 설정·저장소

- 미설정·잘못된 seed size는 240을 반환한다.
- `1000`은 1,000건 모드로 해석한다.
- 기본 모드와 성능 모드가 서로 다른 storage key를 사용한다.
- 빈 성능 모드 storage는 정확히 1,000건을 생성한다.
- 성능 모드의 성공한 단계 변경은 같은 모드 재조회에서 유지된다.
- 기본 240건 storage는 성능 모드 실행으로 변경되지 않는다.

### selector·UI 회귀

- `createSeedApplicants(1000)`은 1,000개의 고유 ID를 만든다.
- 1,000건에도 이름+직무 AND 필터와 단계별 그룹화 결과가 정확하다.
- 검색 input 값은 즉시 변경되고, deferred 결과는 최종적으로 최신 조건과 일치한다.
- 결과 count와 컬럼 count가 같은 deferred 결과를 사용한다.
- 필터 초기화, 상세 열기·닫기, 단계 이동, pending·rollback 테스트가 유지된다.

자동 검증 명령:

```bash
npm run lint
npm run test
npm run build
git diff --check
```

## 7. 변경 파일 책임

| 파일 | 책임 |
|---|---|
| `.env.performance` | 1,000건 Vite mode 설정 |
| `package.json` | 성능 모드 개발 실행 script |
| `src/mocks/mockConfig.ts` | 240/1,000 seed size 해석과 테스트 override |
| `src/mocks/mockConfig.test.ts` | seed size 입력 경계 검증 |
| `src/mocks/mockDb.ts` | 모드별 storage key와 기본 seed size 적용 |
| `src/mocks/mockDb.test.ts` | 모드 격리·1,000건 생성·영속성 검증 |
| `src/mocks/seedApplicants.test.ts` | 1,000건 크기와 ID 고유성 검증 |
| `src/features/recruitment-board/model/applicantSelectors.test.ts` | 1,000건 필터·그룹화 정확성 검증 |
| `src/App.tsx` | deferred filter, memoized 계산과 board 렌더 격리 |
| `src/App.test.tsx` | 최종 필터 결과와 기존 UI 계약 회귀 검증 |
| `src/App.module.css` | 측정상 필요한 경우에만 native offscreen rendering 최적화 |
| `README.md` | 1,000건 실행·측정 방법 |

## 8. 제외 범위

- 서버 pagination, infinite query, 별도 검색 index
- debounce timer와 검색 전용 library
- 측정 전 가상 스크롤 dependency
- 다섯 개의 독립 고정 높이 scroll container
- 카드 높이 측정 JavaScript
- bundle splitting과 MSW bundle 크기 개선
- Query cache, mutation, rollback, pending guard, 단계 전이 변경
- 무관한 컴포넌트 분리와 스타일 재설계
- 프롬프트 기록, staging, commit

## 9. 완료 조건

- README의 명령만으로 기본 240건과 별도 1,000건 모드를 재현할 수 있다.
- 두 모드의 localStorage와 성공한 이동 영속성이 서로 독립적이다.
- 1,000건에서 필터 결과와 컬럼 count가 정확하다.
- production trace가 검색·스크롤 목표를 충족한다.
- 기존 Must, `FR-08`, `FR-11` 자동·수동 회귀 시나리오가 통과한다.
- native CSS만으로 목표를 충족하지 못하면 실패 근거를 기록하고 별도 가상화 scope로 분리한다.
