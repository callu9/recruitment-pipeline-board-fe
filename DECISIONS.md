# DECISIONS.md

## D-002. 안전한 단계 이동 정책

### 결정

드래그앤드롭 대신 단계 선택과 이동 버튼을 사용한다. 일반 채용담당자는 허용된 다음 단계 또는 불합격으로만 이동할 수 있으며, 저장 전 native confirmation dialog에서 지원자명·현재 단계·변경 단계를 확인한다.

### 이유

- 키보드 사용자가 별도 대체 경로 없이 같은 흐름을 사용할 수 있다.
- 직접 조작 UI보다 동작 재현과 테스트가 단순하다.
- 잘못된 단계 변경과 향후 외부 알림 상태의 불일치 위험을 줄인다.

### 트레이드오프

- 보드 특유의 직접 조작감은 약해진다.
- 상태 정정과 Undo는 감사 로그를 갖춘 관리자 전용 흐름이 생길 때 검토한다.

## D-003. 지원자 목록은 TanStack Query cache에서만 관리한다

### 결정

지원자 목록을 별도 Zustand나 Context에 복제하지 않고 TanStack Query cache를 단일 진실 공급원으로 사용한다.

### 이유

- API 데이터와 화면 데이터의 이중 관리로 생기는 불일치를 줄인다.
- 낙관적 변경, 성공 응답 병합, 실패 복구를 같은 흐름에서 처리할 수 있다.
- 검색·필터·상세 선택처럼 화면 안에서만 필요한 값은 로컬 상태로 충분하다.

## D-004. MSW와 localStorage로 실제 서버 같은 mock API를 제공한다

### 결정

UI는 실제 `fetch('/api/...')`를 호출하고 MSW가 이를 처리한다. 데이터는 `localStorage`에 저장해 성공한 변경이 새로고침 후에도 유지되게 한다.

### 이유

- 별도 서버 없이도 HTTP 응답, 200~800ms 지연, 약 15% 실패를 재현할 수 있다.
- 로컬 실행과 정적 배포에서 같은 방식으로 동작한다.
- 실패는 저장 전에 결정하고, 테스트에서는 handler override로 성공·실패를 확정해 검증한다.

## D-005. 실패한 지원자만 되돌리고 같은 카드의 중복 요청을 막는다

### 결정

낙관적 이동 실패 시 전체 목록이 아니라 해당 지원자 한 명만 이전 상태로 복원한다. 같은 지원자의 이동은 처리 중이면 동기식 guard로 막고, 서로 다른 지원자의 이동은 병렬로 허용한다.

### 이유

- 오래된 전체 목록을 복원하면 다른 카드의 성공 또는 진행 중 변경까지 덮어쓸 수 있다.
- 실패 영향을 해당 카드로 제한해 데이터 신뢰성을 지킨다.
- 같은 카드의 요청 순서가 뒤바뀌는 문제를 미리 제거하면서도, 다른 카드 작업은 기다리지 않게 한다.

### 트레이드오프

- 한 카드의 저장이 끝날 때까지 그 카드의 추가 이동은 할 수 없다.

## D-010. 단계 이동 결과를 지원자별 pending 및 전역 결과 live region으로 알린다

### 결정

- 처리 중 상태는 `pendingIds`에 포함된 지원자마다 보드 상태 영역의 `<p role="status">`로 알린다. 이 요소는 카드 내부가 아니라 보드 위 상태 영역에 렌더링된다.
- 성공은 보드의 단일 `moveSuccess` 문자열을 `<p role="status">`로, 실패와 rollback은 별도 단일 `moveError` 문자열을 `<p role="alert">`로 알린다.
- 성공과 실패 상태는 서로 분리한다. 따라서 지원자 A의 실패 뒤 지원자 B의 성공이 A의 실패 안내를 지우지는 않지만, 같은 종류의 메시지가 연속되면 마지막 메시지가 이전 메시지를 대체할 수 있다.

### 이유

- 키보드로 실행할 수 있어도 처리 결과를 인지하지 못하면 접근성이 완성되지 않는다.
- `pendingIds`는 서로 다른 지원자의 동시 이동을 지원자별 pending 상태로 표현한다.
- `moveSuccess`와 `moveError`를 분리하면 반대 결과가 서로의 live region을 지우지 않는다. A 실패/B 성공 순서는 `src/App.test.tsx`의 통합 테스트로 확인했다.
- 화면 안의 native live region만으로 필요한 결과를 전달할 수 있다. toast 라이브러리, 전역 상태 저장소, 자동 닫힘 타이머는 새 의존성·상태 소유권·시간 상태를 추가하므로 기각한다.

### 사용자 검증 범위

- 완료: 기록된 사용자 검증에서 키보드 단계 이동, 지원자별 pending status와 `aria-busy`·비활성 컨트롤, 강제 성공 status, 강제 실패 rollback alert·카드 위치 복원, A 실패 뒤 B 성공 시 두 결과의 공존을 확인했다.
- 미검증: VoiceOver에서 성공·실패와 여러 지원자의 동시 pending 메시지가 안내되는 순서는 확인하지 않았다.
- 코드 한계: 성공·실패 결과는 지원자 ID를 포함하지 않는 보드 단일 문자열이므로 같은 종류의 동시 결과를 각각 보존하는 구조는 아니다. 이 범위에서는 기존 테스트가 보호하는 반대 종류 결과의 공존만 채택한다.

## 기각한 범위

### FR-09. Undo — Should, 기각

- 결정: 성공한 가장 최근 이동을 되돌리는 Undo는 구현하지 않는다.
- 이유: 단계 변경이 향후 지원자 알림 같은 외부 상태를 일으킬 수 있어 역방향 이동이 화면 상태와 외부 상태를 불일치시킬 수 있다.
- 후속 조건: 감사 로그와 권한을 갖춘 관리자 전용 상태 정정 흐름이 별도 설계될 때 역방향 변경과 실패 정책을 다시 검토한다.

## 남긴 기능

### FR-10. 1,000건 성능 — Should, 미완료

- 시도한 범위: 기본 240건에서 클라이언트 필터·단계 그룹화와 컬럼 스크롤을 구현하고, 측정되지 않은 지연 렌더링·검색 인덱스·가상화를 추가하지 않았다.
- 중단한 이유: Must와 핵심 동시성·접근성 검증을 우선했고, 1,000건에서 재현된 렌더링 병목이나 별도 데이터 모드가 없어 최적화 효과를 입증할 근거가 없다.
- 현재 코드에 미완성 흔적을 남겼는지: 1,000건 데이터 모드, 메모이제이션, 컬럼별 가상 스크롤, README 실행 방법은 구현하지 않았으며 임시 placeholder나 죽은 최적화 코드는 남기지 않았다.
- 이어서 구현한다면 첫 단계: 1,000건 고정 fixture와 실행 방법을 추가하고 필터 입력 지연·컬럼 스크롤을 측정한 뒤, 병목이 확인될 때만 selector 메모이제이션과 컬럼별 가상화를 적용한다.
- Must 결과물에 미치는 영향: 기본 240건의 FR-01~FR-08 및 FR-11 구현에는 영향이 없지만, FR-10의 1,000건 부드러운 동작 수용 기준은 아직 충족하지 않는다.

## D-011. 채용 운영 workspace의 범위와 안전한 단순화

### 결정

- 기존 다섯 컬럼 보드는 Applicants dense table/list와 Applicants·Today·Calendar·Positions 탭으로 대체한다.
- 일정·평가·메모·timeline·포지션은 기존 지원자 Query cache와 최소 mock API 응답에 함께 둔다. 외부 calendar/email/ERP 연동은 추가하지 않는다.
- 일반 단계 변경은 확인 없이 시작하고, HIRED/REJECTED만 native confirmation dialog를 사용한다.
- 날짜는 결정적인 `WORKSPACE_TODAY` seed 기준(`2026-09-07`)으로 생성해 mock 화면과 테스트가 안정적으로 오늘 큐를 보여 주게 한다. 실제 운영에서는 서버 기준 날짜로 교체한다.
- 좁은 화면에서는 페이지 전체가 아니라 table/calendar 영역만 가로 스크롤한다. 다섯 컬럼을 가로로 탐색하는 보드는 복원하지 않는다.
- Undo는 외부 시스템과의 상태 불일치를 만들 수 있고 안전한 역방향 API 정책이 없어 구현하지 않는다.

### 이유

- 운영자가 한 화면에서 다음 액션·일정·평가 공백을 확인하려면 카드보다 정렬 가능한 행과 보조 panel이 정보 밀도와 맥락 보존에 유리하다.
- 실제 API와 Query cache를 유지하면 화면별 local state 복제나 fake metrics 없이 같은 지원자 데이터를 재사용할 수 있다.
- terminal 상태만 확인하게 하면 일상 작업의 마찰은 줄이면서 되돌리기 어려운 결정을 한 번 더 확인할 수 있다.

### 미완료/제한

- seed 날짜는 제품의 시간대·서버 시계 연동이 아니므로 운영 캘린더의 timezone 정책은 후속 범위다.
- 현재 mock은 240명의 전체 행을 렌더링하며 별도 virtualization을 추가하지 않았다. 실제 1,000건 병목이 측정될 때만 최적화한다.

## D-012. workspace post-review fixes

### 결정

- Calendar 주간 날짜는 `toISOString()`으로 표시하지 않고 local `Date` 구성요소로 포맷해 `WORKSPACE_TODAY`부터 7일을 포함한다. 날짜-only mock 값은 UTC 변환 대상이 아니다.
- valid legacy v1 applicants는 기존 필수 데이터와 stage를 보존한 채 seed ID/index에 대응하는 workspace 필드만 backfill하고 localStorage에 다시 저장한다. 이미 값이 있는 optional 필드(특히 `schedule: null`, 빈 배열)는 덮어쓰지 않는다.
- terminal confirmation은 submit origin button을 기억하고 cancel/Escape/unmount 시 그 button으로 focus를 복원한다. 확인 후에는 optimistic move 흐름을 그대로 유지한다.
- Today 큐의 모든 action은 실제 동작인 상세 panel 열기를 표시하도록 `상세 보기`로 통일한다. 별도 평가/일정 mutation은 범위 밖이다.
- 상세 panel의 포지션은 ID가 아니라 positions Query 결과의 title로 표시하며, 매칭되지 않은 ID는 raw ID를 노출하지 않고 `미지정`으로 표시한다.

### 검증

- post-review RED 테스트에서 UTC 주간 drift, legacy workspace field 누락, terminal focus 손실, misleading Today labels, raw position ID를 각각 재현했다.
- 각 수정은 기존 Query cache source, pending guard, entity-only rollback, terminal-only confirmation 계약을 변경하지 않았다.

## D-013. workspace hardening의 날짜·전이·검증 경계

### 결정

- 화면과 큐/캘린더 selector는 실제 local date를 사용하고, seed 생성기는 날짜를 인자로 받을 수 있으며 새 데이터의 기본값도 local date로 둔다. 이미 저장된 localStorage snapshot은 사용자의 데이터를 보존한다.
- stage, timeline, nextAction, rejection metadata는 하나의 순수 `applyStageTransition` 결과로 함께 갱신하고, optimistic cache와 mock API가 같은 함수를 공유한다.
- HIRED/REJECTED는 actionable Today 큐와 Calendar에서 제외하고, 상세의 기존 timeline과 일정 데이터는 보존한다. 단계 정정은 상세의 명시적 확인 흐름으로만 제공한다.
- Today 탭 수는 네 큐의 중복을 제거한 actionable 지원자 수로 표시하고, 각 큐는 전체 항목을 렌더링한다.
- Pull request와 dev push는 같은 검증 job에서 lint/test/build를 통과해야 하며, Pages 배포는 검증 job을 `needs`로 요구하는 dev push에서만 실행한다.

### 이유

- 날짜를 한 곳에서 고정하면 운영 화면이 시간이 지날수록 낡고, 날짜를 순수 함수 인자로 주면 테스트 결정성을 유지할 수 있다.
- 전이 결과를 한 domain operation으로 만들면 서버 성공과 optimistic 상태가 timeline/nextAction을 서로 다르게 남기는 회귀를 막는다.
- 배포를 동일 workflow의 검증 job 뒤에 두면 `workflow_run`의 기본 브랜치·권한·신뢰 경계 문제 없이 검증된 동일 revision만 Pages에 올라간다.

## D-014. action copy와 조회 재시도 상호작용 경계

### 결정

- 활성 단계의 primary action은 단계 정책을 유지하면서 `면접 집행`, `처우 협의`, `최종 합격`으로 표시한다. 지원자별 accessible name은 지원자 식별자를 suffix하고, secondary action의 visible label은 `불합격`을 유지한다.
- applicants 조회 retry는 자동 재시도를 추가하지 않고, 사용자가 누른 한 번의 `refetch` 요청이 진행 중일 때만 retry button을 동기적으로 비활성화한다. 재요청은 `cancelRefetch: false`로 기존 요청을 취소하지 않으며, 실패율 약 15% 설정은 그대로 둔다.

### 이유

- 기존 primary label이 사용자가 승인한 concise copy와 달라 production UI·접근성 이름이 모두 오래된 문구를 노출했다.
- 기존 error branch의 retry button은 refetch 중에도 활성 상태여서 빠른 연속 입력이 진행 중인 요청을 취소할 수 있고, 조회 상태 변화가 error UI를 즉시 교체해 실제 재요청 여부를 사용자가 확인하기 어려웠다. local pending guard와 `aria-busy`로 한 번의 재시도 흐름을 명시했다.

### 검증 경계

- forced one-failure/one-success 통합 테스트에서 두 번째 GET 호출과 workspace 복귀를 확인한다.
- 기본 mock API의 failure rate를 낮추거나 자동 retry로 바꾸지 않는다.

## D-015. 기존 평가 엔티티를 전형 피드백으로 사용한다

### 결정

- 별도 feedback 엔티티 없이 `ApplicantEvaluation`을 전형별 피드백으로 사용한다.
- 피드백은 API 성공 뒤 Query cache에 병합하고 stage 이동만 기존 optimistic update를 유지한다.
- 평가자, 점수, 코멘트와 작성일을 저장하고 타임라인에 작성 사실을 남긴다.

### 이유

- 현재 평가 상태와 새 피드백 저장소를 이중 관리하지 않는다.
- form 입력은 실패 뒤 그대로 유지하면서 저장되지 않은 평가가 다른 화면에 노출되는 일을 막는다.

### 남긴 범위

- 여러 평가자의 독립 제출, 승인, draft, 첨부 파일은 구현하지 않는다.
- 피드백과 일정에 따른 정상 전진 gate는 `[stage-scheduling]` scope에서 연결한다.

## D-016. shadcn 기반 UIUX 개선과 클라이언트 페이지네이션 — 설계 제안

### 상태와 근거

- 2026-10-07 사용자 요청으로 페이지네이션 단독 명세를 UIUX 통합 명세로 확장했다.
- shadcn/ui와 shadcn lint 활용은 사용자 지정이다. 세부 UX·규칙 정책은 검토용 제안이며 설치·구현·사용자 검증 전이다.
- 상세 기준: [UIUX 개선 명세](docs/superpowers/specs/2026-10-07-workspace-uiux-improvement-design.md).

### 제안

- 전체 Query cache에 필터·정렬을 적용한 뒤 표시 행만 나눈다. 기본 20명, 20·50·100명 선택과 이전·다음 이동을 제공한다.
- 필터·정렬 변경은 1페이지, 단순 업무 탭 왕복은 탐색 맥락을 유지한다. 마지막 페이지 보정 후 실패 rollback은 엔티티만 복원하고 보정된 페이지를 유지한다.
- shadcn/ui + Tailwind v4를 필요한 화면부터 도입하고 @shadcn/lint를 기존 ESLint에 연결한다. 디자인 규칙 적용 경로·component 예외를 명시하고 위반 예제로 검출을 확인한다.
- 입력 보호·작업 위치 결과·상세·가독성·캘린더를 기능별 scope로 구현한다. 상세와 확인은 같은 Radix overlay 계열로 전환하고 기존 focus·Escape 계약을 검증한다.
- 다음 행동·일정 입력은 기존 stage-scheduling 설계로 이어서 실제 API까지 연결한다. mock 데이터 정리를 자동으로 포함하지 않는다.

### 이유와 트레이드오프

- 검증 가능한 기본 컴포넌트와 lint 수정 루프로 UI 제작 시간을 줄인다. 의존성 없는 구현이라는 이전 초안의 제약은 이번 사용자 요청에 따라 대체한다.
- 초기 Tailwind·alias·lint 통합과 기존 CSS 충돌 검증 비용은 필요하다. 전체 CSS 재작성·전역 store·테이블 엔진은 추가하지 않는다.
- 전체 조회 비용은 남으며 성능 목표 달성을 별도로 주장하지 않는다. 디자인 lint 통과는 접근성·업무 흐름·실제 브라우저 검증을 대체하지 않는다.

### applicants-pagination 구현 후보

- 사용자가 통합 명세 이후 구현을 요청해 §3·§4를 첫 scope로 채택했다. 현재 사용자 검증·기록·커밋 전 후보이며 나머지 UIUX scope는 구현하지 않았다.
- shadcn CLI `4.21.3` (init `--base radix --preset nova`)로 다섯 컴포넌트를 생성하고 `@shadcn/lint 0.2.0`, Tailwind `4.3.3`을 고정했다. 기존 밝은 배경·파란 primary와 system font를 유지한다.
- CLI가 추가한 Geist 폰트, 미사용 animation CSS와 shadcn CLI 런타임 패키지·cn 재수출 helper는 제거했다. 현재 생성 소스가 사용하는 cn/CVA/Radix/lucide만 유지한다. 컴포넌트 추가는 동일 CLI 버전의 npx로 실행할 수 있다.
- 페이지를 결과에 즉시 보정하고 state에도 저장해 실패 복원 후 과거 페이지로 되돌아가지 않게 한다. filter 이벤트에서 1페이지를 설정해 같은 인원수의 다른 검색도 초기화한다.
- 제목 fallback은 현재 modal과 다른 컨트롤의 유효한 focus를 보존한다. 현재 단계 버튼을 ApplicantsView에 함께 옮겨 상세와 중복 구현하지 않는다. 상세/확인은 이 scope에서 native dialog를 유지한다.
- lint 적용 경로는 새 제품 UI와 생성 UI 정의로 한정한다. 정의 내부의 세 규칙 예외는 공식 가이드에 따른 것이며 기존 React/TypeScript 규칙을 해제하지 않는다. 생성된 미사용 variant export는 제거해 Fast Refresh warning을 피한다.

### 사용자 흐름 피드백에 따른 후보 수정과 우선순위

- 2026-10-07 사용자는 하단 페이지 크기 선택의 불편과 면접 일정 입력·업무 연결 부재를 지적했다. 기존 후보 승인으로 해석하지 않는다.
- 페이지당 표시·전체 결과·표시 범위를 단계 필터 아래·첫 행 위로 옮기고 하단은 이전/다음·현재 페이지로 유지한다. 하단에 모두 두었던 제안은 표시 수 조작에 불필요한 스크롤을 요구해 기각했다.
- 현재 pagination gate 이후 다음 scope를 `stage-scheduling`으로 올린다. 피드백→면접/처우 일정 등록→단계 진행→Applicants/Today/Calendar 반영을 필터·정렬·overlay 전환·가독성·캘린더 탐색 폴리시보다 먼저 구현한다.
- 현재 일정은 읽기 전용 `InterviewSchedule`이고 일정 PUT, form 진입점, 상태 기반 action, 정상 전진의 피드백/일정 선행조건 검사가 없다. 현재 후보를 사용자 흐름 개선 완료라고 부르지 않는다.
- 기존 피드백 API/form/cache 병합과 개별 stage rollback을 재사용한다. 일정 종류/담당자 모델, legacy 일정 보존과 nextAction migration 정리, 등록/변경·담당자 일정 확인·실패 입력 유지/재시도·서버 gate·세 탭 반영의 다음 작업은 통합 명세 §6.1에 준비했다. 데이터 reset과 가짜 action 버튼은 추가하지 않는다.

## D-017. 현재 후보를 applicants-workspace-ux로 확장하고 Sonner로 결과 안내

- 2026-10-07 사용자의 추가 요청으로 현재 미커밋 pagination 후보에 압축 지표, 필터·정렬·칩, 행 상세 진입, 한국어 nav, outline 전진/불합격 메뉴, 중앙 footer와 Sonner를 포함한다. scope 이름은 `applicants-workspace-ux`, 브랜치는 이미 작업 중인 `feat/applicants-pagination`을 유지한다. 이 요청은 최종 검증·stage·commit 승인이 아니다.
- D-010의 toast/자동 닫힘 타이머 제외와 통합 명세의 inline mutation 배너 정책은 이 명시적 요청으로 대체한다. [공식 shadcn Sonner](https://ui.shadcn.com/docs/components/radix/sonner)를 사용하며 deprecated Toast를 추가하지 않는다. 성공 4초, 단계 실패 Infinity·수동 닫기/동일 지원자 재시도 성공 해제로 구분한다. form 실패와 query 실패는 원래 위치에 남긴다.
- 단일 Sonner live region과 작업·지원자별 toast ID로 A 실패/B 성공의 독립성을 유지한다. 기본 body Toaster가 native dialog 뒤에 가리는 것을 실제 브라우저의 hit test로 확인했다. 같은 portal host를 현재 최상위 dialog로 옮겨 Toaster를 재마운트하거나 결과를 중복 낭독하는 별도 배너를 만들지 않는다.
- 레지스트리가 추가한 next-themes와 실제 생성되지 않는 animation utility는 제거했다. 테마는 기존 light token을 사용한다. 반복적인 UI 색 변경은 Button/Table variant·정의 안에서 처리해 제품 UI의 shadcn lint를 우회하지 않는다.
- 첫 desktop 측정에서 footer gap이 registry 기본 2px로 남은 것을 발견해 8px로 수정했다. footer는 Table 스크롤 밖 전체 너비·중앙 정렬, 버튼 80×44px, 상하 16px를 기준으로 검증한다.
- 다음 최우선은 여전히 `stage-scheduling`이다. 일정 모델/API/form/선행조건은 이번 scope에서 구현하지 않는다. 남은 상세 입력 보호·Calendar 탐색·다른 탭 가독성도 완료로 기록하지 않는다.

### applicants-workspace-ux hover 회귀 수정 — 사용자 재검증 전

- 사용자 지적으로 일반 행 hover의 `bg-muted/50`와 sticky 셀의 `bg-muted` 불일치, selected 이름 버튼의 독립 hover 배경을 실제 브라우저에서 재현했다. 앞선 후보 검증이 이 포인터 상태를 놓쳤다.
- TableRow가 기본/hover·메뉴 열림/selected의 불투명 배경을 소유한다. selected가 다른 상태보다 우선하도록 hover·expanded selector에서 selected를 제외한다. sticky head/cell은 bg-inherit, 이름 버튼은 투명 배경을 사용한다. 행 배경 transition을 제거해 별도 셀의 상태 변경 시차를 없앤다. header hover는 적용하지 않으며 다른 액션 Button의 hover/focus는 유지한다.
- API/저장소 호출 없는 실제 ApplicantsView 임시 fixture에서 실제 viewport 1440/768/390을 assert하며 이름·일반 셀·메뉴 포인터, selected, 메뉴 열림 후 포인터 이탈, 768/390 가로 스크롤의 computed 렌더 색을 확인했다. 부모 세션도 일반 화면의 일반/name/expanded hover·기본색 복귀·header를 독립 확인했다. 임시 fixture는 제거했다.
- raw CDP PNG의 배율/기본 clip이 CSS 좌표와 달라 전체 픽셀 assertion은 실패했다. 이를 통과로 보고하지 않는다. CSS clip을 명시한 대표 390px PNG만 정상 캡처했다. 추가 탐색 중단 요청에 따라 나머지 raster 검증은 미확인으로 남긴다. 앞서 부모 viewport 조작을 원인으로 추정한 표현은 철회한다.
- 최종 lint 통과, test 9파일145개 통과(32.39s), build 통과(JS855.25kB, >500kB 경고 유지), scope diff check 통과. 사용자 승인·PROMPTS 기록·staging·commit은 아직 없다.

### PR 게시 요청 — 2026-10-07

- 사용자가 수정 후보와 검증 한계를 보고받은 뒤 PR 게시를 요청했다. 현재 applicants-workspace-ux 범위의 기록·커밋·push·PR 생성을 진행한다. 별도의 사용자 수동 검증 결과는 보고되지 않았으며, 위 미확인 항목과 stage-scheduling 후속 범위를 유지한다.


## D-018. 채용 운영 리뷰 회귀와 URL 조회 맥락 복원

- 기존 미커밋 접수·전형·오퍼·입사·보관 운영 확장은 보존한다. 활성 인재풀과 보관 목록은 같은 합집합 predicate로 목록과 count를 계산해 중복 없이 노출한다.
- 성공한 담당 업무 저장 후 추가형 메모만 비운다. 실패 입력과 나머지 업무 필드는 유지하며, 동일 메모를 재입력하지 않은 반복 저장으로 메모가 늘지 않는다. 같은 문장을 의도적으로 다시 입력하는 사용자의 기록까지 서버에서 제거하지 않는다.
- 캘린더 일정 미정은 면접 유형과 직무·담당자를 함께 적용한다. 이전 단계의 면접은 현재 표 일정에서 제외하고 상세의 이전 면접 일정으로 보존한다.
- 사용자가 요청한 최소 URL 범위는 업무 탭, 지원자 필터·정렬·페이지·크기, 선택 지원자 ID다. Query cache와 pending guard는 그대로 사용한다. 입력·페이지 변경은 replaceState, 탭·상세 전환은 pushState, popstate는 조회 상태만 복원한다. 외부 query/hash를 보존하고 잘못된 enum/페이지 값은 기본값으로 읽는다. 캘린더 내부 주간/유형 필터까지 URL 범위를 확대하지 않는다.
- 원격 CI에서 240명 검색·탭 왕복·포지션 진입 통합 테스트가 5687ms로 기본5000ms를 초과했다. 같은 240명 fixture와 전체 큐·검색 맥락·포지션 초기화 검증을 두 독립 테스트로 나누고 timeout은 유지한다. 로컬 분리 실행은2164ms/1644ms였으나 원격 CI 통과는 아직 주장하지 않는다.
- 실제 Chrome의 Back 상세 종료에서 BODY로 포커스 유실을 발견해 실패 테스트와 기존 trigger/heading 복원을 추가했다. URL 페이지의 최초 조회 중 clamp도 실패 테스트로 확인해 조회 성공 후에만 보정한다.
- 필수 prompt-record hook 세션 값은 이 위임 컨텍스트에 없다. 임의 로그 선택 없이 기록·staging·commit·push·PR은 보류하고 원래 작업 세션의 공식 hook 기록이 필요하다. 실제 BE·인증·다중 사용자 검증으로 보고하지 않는다.


### recruitment-operations 게시 승인 — 2026-10-08

- 사용자가 기존 변경과 리뷰 수정의 필수 기록·커밋·push·dev 대상 draft PR 생성을 명시적으로 요청했다. 공식 hook 세션의 prompt reader를 읽어 기록 보류 사유를 해소한다. 기존 구현 세션의 원문은 추정·대체하지 않는다.
- 앱 코드 수정 없이 lint·build와 전체 테스트 재실행(14개 파일·247개)이 통과했다. 최초 전체 실행의 두 시간 초과와 단독 통과도 PROMPTS.md에 함께 남긴다. 실제 브라우저 수동 테스트를 이번 세션에서 새로 수행했다고 보고하지 않는다.
- 기본 데모는 고유 이름 30명이며 기존 240명 저장 데이터와 명시적 대량 fixture를 보존한다. PRD의 읽기 전용 비목표·기본 240명 등 과거 명세와 현재 확장 간 차이는 알려진 문서 한계로 남긴다.
- 관련 코드·테스트·PRD/TECH_SPEC 최소 수정·루트 결정 기록·현재 프롬프트만 커밋한다. 기존 AGENTS.md 변경과 빈 PR/결정 템플릿은 제외한다. 병합·배포는 요청 범위에 없다.


## D-019. UI 감사의 명확한 수정과 구조 결정 분리

- 사용자에게 실제 화면 감사와 수정 후보를 전달하고 PR 반영 승인을 받았다. 공통 Button/Input/NativeSelect, native dialog 위치, 확인 form 연결, alert/status 색상, 빈 상태의 이유·복구, 기존 평가 용어와 UX-06 날짜 표현은 현재 규칙으로 결정되는 수정이다. 새로운 단계/발송/권한/운영 정책을 만들지 않는다.
- 일반 입력과 재시도·달력 탐색·상세 링크만 공통 component로 정리한다. 이름·달력 전체 클릭 카드와 기존 navigation을 무조건 default Button으로 바꾸지 않는다. 기존 공통 Textarea/Checkbox가 없어 임의 dependency나 variant를 만들지 않는다.
- 지속적인 form/query 실패는 입력·복구 버튼 근처 인라인, 위험한 단계 결정은 native modal, 비차단 단계/평가 완료는 기존 Sonner 또는 해당 form status를 사용한다. 성공 문구가 빨간 오류 스타일을 공유하던 문제를 수정하며 모든 메시지를 toast로 일괄 변경하지 않는다.
- 업무 우선 목록/상세, 내부ID·예외 작업의 정보 순서, 접수 진입, nav 집계 단위와 브랜드는 별도 사용자 결정이다. 승인용 HTML은 repo 밖 가상 데이터이며 제품 구조 변경으로 게시하지 않는다.
- 최종 lint·14파일252tests·build·diff check 및 실제 Chrome/CDP 상태 검증을 수행했다. 기존 MSW/localStorage/임시 프로필 결과를 운영 BE·실제 사용자 데이터 검증으로 보고하지 않는다. 번들 경고, 전체 대비·VoiceOver·IME·가상 키보드·운영 전체 E2E는 남는다.
- 공식 prompt hook이 없어 최초 기록·게시는 보류했다. 사용자가 Sentinel_716f6cb791bc8191b7dfa0753f2f2d82의 '응!'으로 이번 UI 수정에만 실제 대화의 수동 기록 예외를 승인했다. PROMPTS의 현재 scope에 원문과 질문·답변을 수동 기록한다. 가짜 hook, 다른 세션 로그, 영구 지침 변경은 사용하지 않는다.
- 기존 AGENTS.md 수정과 미추적 템플릿/docs/codex는 scope staging에서 제외하고 보존한다. 기존 OPEN draft PR12에 추가하며 병합·배포는 하지 않는다.

- UI scope12개 파일을 staging한 후 커밋·push는 자동 승인 검토가 현재 환경에서 신뢰된 게시 승인을 확인하지 못해 거절했다. 실행되지 않은 커밋/push/새SHA CI를 완료로 보고하지 않는다. HEAD22487dc5와 staging을 보존하며 부모 승인 문맥의 후속 실행 또는 현재 환경의 확인 가능한 실행 승인으로 해소한다.


## D-020. 승인된 업무 중심 구조를 기존 운영 정책 위에 적용

- 사용자가 승인한 시안 방향과 감사 R01/R02/R03/R05를 `workspace-workflow` 한 범위로 구현한다. 원래 branch/HEAD에서 진행하며 사용자 AGENTS/템플릿/docs/codex 변경은 보존한다.
- 업무 주 행동은 기존 active predicate를 사용하는 순수 selector로 계산한다. 목록/Today에서 폼으로 바로 연결하고 기존 단계 진행을 보조 행동으로 유지한다. 인증/소유 권한이 없어 시안의 ‘내 업무’ 탭을 권한 기능으로 새로 구현하지 않는다.
- desktop에서는 nonmodal native list/detail split, mobile에서는 목록을 숨긴 상세 집중 화면을 사용한다. 지원 정보/이력과 내부ID 접힌 영역을 구분하고 mounted hidden form으로 초안을 보존한다. 접수는 제목 옆 native modal이며 폼의 lock/pending은 창 수명 밖에서 유지한다.
- 독립 리뷰의 같은 지원자 재진입 알림 host, 이전 평가 focus, 접수 pending remount, 철회 후 통보 CTA 4건을 실패 테스트로 재현하고 수정했다. 최종 전체264tests/lint/build/diff 및 Chrome 증거를 상세 HTML에 기록한다. 미확인 전체 대비·VoiceOver·실제 모바일 기기·발송/운영 BE를 통과로 주장하지 않는다.
- 현재 범위의 prompt hook 정보는 없다. 이전 UI 감사의 수동 예외를 재사용하거나 다른 로그를 읽지 않는다. 새 범위 기록과 게시는 정상 hook 또는 이번 범위에 대한 신규 명시적 수동 기록 승인이 있어야 진행한다.

- 2026-10-10 05:18:33 UTC 사용자 신규 승인으로 이번 `workspace-workflow`에 한해 실제 대화의 수동 기록 예외를 적용한다. 승인 원문과 출처는 PROMPTS의 현재 scope에 남긴다. 가짜 hook ID·상시 규칙 변경·이전 예외 재사용 없이 현재 변경을 기능 브랜치와 기존 Draft PR12에 게시하며 최신 SHA CI를 확인한다.
