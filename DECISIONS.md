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
