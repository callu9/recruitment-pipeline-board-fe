# PROMPTS.md

## 작성 원칙

- 기능 scope와 커밋 scope를 동일하게 사용한다.
- 주요 프롬프트는 요약이 아니라 실제 문구를 남긴다.
- `AI 출력 요지`는 결과를 짧게 요약한다.
- `리뷰 / 검증`에는 실제로 읽거나 실행하거나 재현한 내용만 쓴다.
- 코드와 해당 기능 기록을 같은 커밋에 포함한다.
- 사소한 오타 수정은 생략할 수 있으나, 설계·구현·디버깅에 영향을 준 프롬프트는 남긴다.
- 검증하지 못한 사항은 `미검증`이라고 명시한다.
- 계획·문서 검토도 하나의 scope로 기록한다. 세션명이 `00-planning-review`라면 제목과 커밋 scope도 `[00-planning-review]`로 동일하게 사용한다.

## [00-planning-review] 요구사항·설계·커밋 계획 검토

### 목표 / 수용 기준

- 과제 Must 요구사항의 문서 누락 확인
- PRD와 TECH_SPEC 정합성 검토
- 기능별 커밋 경계 검토
- 낙관적 업데이트·경쟁 상태 설계 검토
- 6~10시간 범위의 과설계 제거
- 코드 생성, 프로젝트 초기화, 자동화, 커밋은 수행하지 않음

### 프롬프트 1 — 최초 문서 검토

00-planning-review

이 저장소는 AI 협업 과정을 기능별 커밋과 PROMPTS.md로 제출하는 프론트엔드 채용 과제다.

먼저 AGENTS.md와 docs/ASSIGNMENT.md, docs/PRD.md, docs/TECH_SPEC.md,
docs/IMPLEMENTATION_AND_COMMIT_PLAN.md, DECISIONS.md를 모두 읽어라.

이번 단계에서는 코드를 생성하거나 프로젝트를 초기화하지 마라.
다음만 검토해라.

1. 과제 Must 요구사항 중 문서에 누락된 항목
2. PRD와 TECH_SPEC 사이의 모순
3. 한 커밋에 두 기능이 섞일 가능성이 있는 작업 단위
4. 낙관적 업데이트 실패 롤백과 경쟁 상태 설계의 취약점
5. 6~10시간 범위에서 제거해야 할 과설계

각 발견은 근거 문서와 섹션을 명시하고,
`문제 / 영향 / 최소 수정안` 형식으로 제시해라.
확실한 문제와 선택 가능한 개선안을 구분해라.
파일은 수정하지 말고 검토 결과만 출력해라.

### AI 출력 요지

- Must 기능 전체가 누락된 경우나 PRD–TECH_SPEC의 직접적인 동작 모순은 없다고 판단했다.
- 다음 수용 기준의 기술·검증 계획 연결이 부족하다고 지적했다.
  - 현재 데이터에서 직무 필터 옵션 생성
  - 상세 패널 종료 후 검색·필터·스크롤 맥락 유지
  - mock API의 200~800ms 지연과 기본 실패율 검증
- 낙관적 업데이트와 동일 지원자 pending guard가 별도 커밋에 분리되어 중간 커밋이 경쟁 상태에 취약하다고 지적했다.
- 여러 기능의 회귀 테스트를 한 커밋에 모으는 계획이 기능별 커밋 원칙을 흐릴 수 있다고 판단했다.
- `version`, `total`, `stageUpdatedAt` 정렬, 선행 `useDeferredValue`, 별도 스켈레톤, Undo, 1,000건 가상화를 과설계 후보로 제시했다.

### 후속 프롬프트 2 — 문서 반영 요청

PROMPTS.md 작성 및 자동화는 제외하고
(추후 프로젝트 세팅 및 개발 시작 시부터 예정)
전부 문서에 반영후 재검토
아직 커밋은 하지 않는다.

### 반영 내용

- 과제 원문, PRD FR, TECH_SPEC, 구현 커밋, DECISIONS, README를 연결하는 추적성 표를 추가했다.
- GET 응답을 별도 `total`이 없는 `Applicant[]`로 단순화했다.
- 사용되지 않는 `version`과 `stageUpdatedAt`을 제거했다.
- 직무 옵션을 현재 지원자 데이터에서 생성하도록 명시했다.
- 상세 패널이 검색·필터·스크롤 맥락을 보존하도록 수용 기준과 검증 시나리오를 추가했다.
- 동일 지원자 synchronous pending guard와 다른 지원자 병렬 이동을 `optimistic-update` 범위에 포함했다.
- 서로 다른 두 PATCH 성공 결과가 모두 `localStorage`에 유지되는 검증 시나리오를 추가했다.
- 커밋 계획을 16개에서 12개로 줄였다.
- Undo와 1,000건 가상화는 활성 구현 범위에서 제외했다.
- CSS 전략을 CSS Modules로 통일했다.
- Vite 초기화 시 기존 문서를 보존하고, dev 서버는 30초 안에 준비 여부를 확인한 뒤 종료하도록 명시했다.

### 리뷰 / 검증

#### 문서 정독

- 채택:
  - 데이터 기반 직무 옵션 생성
  - 상세 패널 맥락 유지 검증
  - 엔티티 단위 롤백
  - 동일 지원자 synchronous pending guard
  - 서로 다른 지원자의 병렬 이동·저장 검증
- 수정:
  - 경쟁 상태 검증을 별도 후행 커밋에서 `optimistic-update` 커밋으로 이동
  - 여러 기능을 묶은 회귀 테스트 커밋 제거
  - 커밋 scope와 향후 PROMPTS scope 통일
- 기각:
  - 실제 충돌 검출에 사용되지 않는 `version`
  - 페이지네이션 없이 중복되는 `total`
  - Must가 아닌 정렬을 위한 `stageUpdatedAt`
  - 측정 전 `useDeferredValue`·가상화
  - 로컬 mock의 단일 stage 요청에 대한 별도 body 크기 제한

#### 자동 검증

- 실행:
  - Markdown code fence 개수 검사
  - trailing whitespace 검색
  - 커밋 scope와 향후 PROMPTS scope 대응 검색
  - 제거 대상 용어 잔존 여부 검색
  - `git diff --check -- README.md`
  - 문서 QA
- 결과:
  - Markdown code fence가 모두 정상적으로 닫혀 있었다.
  - trailing whitespace가 발견되지 않았다.
  - 계획된 커밋 scope와 향후 PROMPTS scope가 일치했다.
  - 최종 문서 QA 결과는 `0.94 PASS`였다.

#### 미검증 범위

- 프로젝트가 초기화되지 않아 다음 명령은 실행하지 않았다.
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- API, 롤백, 접근성, 성능의 실제 동작은 구현 이후 기능별로 검증해야 한다.
- 커밋은 수행하지 않았다.

#### 사용자 최종 판단

- 채택 여부: 사용자 diff 확인 후 작성
- 최종 확인 범위: 사용자 확인 후 작성
- 남은 위험: 실제 구현과 브라우저 동작은 아직 미검증

### 연결 커밋

- 메시지: `docs(00-planning-review): 과제 요구사항과 구현 기준 검토`
- 해시: `d907088`

## [project-setup] React TypeScript 프로젝트와 품질 도구 초기화

### 목표 / 수용 기준

- 연결 근거: D-001, 구현·커밋 계획 Commit 02
- 이번 기능에서 완료할 범위:
  - Vite 기반 React + TypeScript 앱 초기화
  - TanStack Query provider 연결
  - ESLint, Vitest, React Testing Library, MSW Node server 테스트 기반 설정
  - 기본 예제 제거 및 빈 app shell 렌더링
- 이번 기능에서 하지 않을 범위:
  - Applicant 도메인 타입·stage 상수
  - MSW API handler·localStorage 저장소
  - 보드·카드·검색·단계 이동 UI
  - 커밋

### 프롬프트 1 — 최초 지시

AGENTS.md와 아래를 읽고 작업. 참고: 이번 작업 scope는 project-setup 하나뿐이다.

목표:

- Vite React TypeScript 프로젝트 초기화
- 기본 예제 제거
- TanStack Query provider 연결
- Vitest + React Testing Library + MSW Node 테스트 기반 설정
- lint, test, build가 통과하는 빈 app shell 구성

금지:

- Applicant 도메인 타입 작성
- mock API handler 작성
- 보드/카드 UI 작성
- 검색, 단계 이동 등 다음 기능 선행 구현
- 커밋 실행

편집 전에 먼저 다음을 출력해라.

1. 생성·수정할 파일
2. 각 파일 책임
3. 실행할 검증 명령
4. project-setup 범위를 넘어갈 위험

그 뒤 최소 구현을 수행하고 실제 lint/test/build 결과와 변경 파일을 보고한 뒤 멈춰라.

### AI 출력 요지

- Vite React TypeScript 기반을 만들고, 기본 예제 화면·자산 대신 제목만 있는 app shell로 교체했다.
- `src/main.tsx`에 단일 `QueryClient`와 `QueryClientProvider`를 연결했다.
- Vitest는 `src/**/*.{test,spec}.{ts,tsx}`만 수집하고, jsdom·RTL matcher·MSW Node server lifecycle을 설정했다.
- `App.test.tsx`에서 Query provider 아래 app shell 제목 렌더링을 확인했다.
- Vite 기본 `oxlint` 설정은 계획에 맞춰 ESLint 설정으로 교체했다.

### 리뷰 / 검증

#### 1. 코드 정독

- 유지:
  - 지원자 원본 상태를 두지 않고 Query provider만 연결했다.
  - MSW Node server는 빈 handler 배열로만 구성해 다음 `mock-api` scope를 선행하지 않았다.
  - 테스트 수집 범위를 `src/`로 제한해 저장소의 `.codex` hook 및 의존성 내부 테스트를 실행하지 않도록 했다.
- 수정:
  - 기본 Vite 예제 자산·카운터·문서 링크를 제거하고 빈 shell로 축소했다.
  - `exclude`만 지정하면 Vitest 기본 제외 목록을 덮어써 `node_modules` 테스트가 수집되는 것을 확인했다. 앱 테스트만 수집하는 `include` 설정으로 교체했다.
- 범위 외로 남김:
  - Applicant 타입, mock API handler, 보드·카드 UI, 검색, 단계 이동.

#### 2. 자동 검증

- 실행 명령:
  - `git diff --check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- 실제 결과:
  - diff whitespace 오류 없음.
  - lint 통과.
  - Vitest: 1개 파일, 1개 테스트 통과.
  - production build 통과.
- 실패한 테스트와 원인:
  - 설정 중 `.codex/hooks`와 `node_modules` 내부 테스트가 수집되어 실패했다.
  - 원인은 Vitest의 기본 제외 목록을 대체한 `exclude` 설정이었다.
  - `src/` 테스트만 수집하도록 변경한 후 전체 테스트가 통과했다.

#### 3. 수동 검증

- 검증: `npm install`, `npm run dev` 실행
- `npm run lint`: 통과
- `npm run test`: 통과
- `npm run build`: 통과
- `git diff --check`: 통과

#### 4. 최종 판단

- 수정 후 채택.
- 내가 자동 검증으로 확인한 범위: Vite build, ESLint, app shell 렌더링 테스트, MSW Node server lifecycle 설정.
- 미검증 또는 남은 위험: 실제 브라우저 렌더링·콘솔 상태는 사용자 확인이 필요하다. MSW handler와 실제 API 동작은 다음 scope에서 구현·검증한다.

### 연결 커밋

- 메시지: `chore(project-setup): React TypeScript 프로젝트와 품질 도구 초기화`
- 해시: `092e31c`

## [prompt-workflow] 세션별 프롬프트 기록 흐름 개선

### 목표 / 수용 기준

- `UserPromptSubmit` 훅이 프롬프트 저장 후 현재 로그 세션 ID를 모델에 전달한다.
- `prompt-record`는 전달받은 세션의 JSONL 파일 하나만 읽는다.
- 세션 ID나 해당 파일이 없으면 다른 로그를 추측하지 않고 중단한다.
- 사이드 대화 로그와 최신 로그 탐색을 사용하지 않는다.
- 관련 단위 테스트를 추가한다.
- `PROMPTS.md` 수정과 커밋은 이번 구현 범위에서 제외한다.

### 프롬프트 1 — 세션 로그 선택 방식 개선

(실제 hook 로그에 저장된 구현 지시 원문을 여기에 그대로 삽입)

### AI 출력 요지

- `capture-prompt.mjs`가 프롬프트 기록 후
  `PROMPT_LOG_SESSION_ID=<session_id>`를 `additionalContext`로 반환하도록 변경했다.
- `prompt-record`가 해당 ID의 로그만 읽도록 전용 reader를 추가했다.
- ID가 없거나 파일이 없을 때 종료하고 다른 로그를 검색하지 않도록 했다.
- 선택된 로그와 사이드 로그가 함께 있어도 선택된 로그만 반환하는 테스트를 추가했다.

### 리뷰 / 검증

#### 1. 코드 정독

- 유지:
  - 기존 JSONL 기록 형식과 세션별 파일 구조
  - 사용자 프롬프트 원문 저장 방식
- 수정:
  - 로그 저장 성공 뒤 세션 ID를 hook output으로 반환
  - `main_session_id` 또는 최신 파일 탐색 대신 hook이 전달한 ID 사용
- 기각:
  - `.codex/session-logs` 전체 glob
  - 수정 시각을 이용한 최신 로그 선택
  - 사이드 대화 로그 병합

#### 2. 자동 검증

- 실행 명령:
  - `node --test .codex/hooks/capture-prompt.test.mjs .agents/skills/prompt-record/prompt-record.test.mjs`
  - `node --check .codex/hooks/capture-prompt.mjs`
  - `node --check .agents/skills/prompt-record/scripts/read-prompt-log.mjs`
  - `git diff --check`
- 실제 결과:
  - Node 단위 테스트 5개 통과
  - 두 스크립트 구문 검사 통과
  - diff whitespace 오류 없음
- 확인한 경계 조건:
  - 지정된 세션 로그만 읽음
  - 세션 ID가 없으면 실패
  - 지정 파일이 없으면 다른 로그를 선택하지 않고 실패

#### 3. 수동 검증

- 사용자 보고: `mock-api` feature에서 프롬프트 기록 흐름 검증 완료.
- 구체적인 재현 단계와 관찰 결과: 미기록.

#### 4. 최종 판단

- 수정 후 채택.
- 확인한 범위: hook 반환 계약, 정확한 세션 로그 선택, fail-closed 동작, 단위 테스트.
- 사용자 확인 범위: `mock-api` feature에서 실제 프롬프트 기록 흐름 검증 완료.
- 남은 위험: 구체적인 수동 검증 절차와 관찰 결과는 기록되지 않음.

### 연결 커밋

- 메시지: `chore(prompt-workflow): 세션별 프롬프트 기록 흐름 개선`
- 해시: `83231eb`
- AI 초안 수정 요약: 최신 로그 추측을 제거하고 hook이 전달한 세션 ID만 사용하도록 제한했다.

## [mock-api] 지원자 조회·단계 저장과 지연·실패·영속화 구현

### 목표 / 수용 기준

- 연결 근거: 과제 §4 mock API 기술 제약, TECH_SPEC §3–5, 구현·커밋 계획 Commit 03
- 이번 기능에서 완료한 범위:
  - Applicant 도메인 타입과 `STAGES`
  - 결정적 240건 seed 및 localStorage 저장소
  - MSW `GET /api/applicants`, `PATCH /api/applicants/:applicantId/stage`
  - browser worker와 테스트용 Node server 연결
  - 200–800ms 지연, 기본 약 15% 실패, `VITE_MOCK_FAILURE_RATE` override
  - 저장소 런타임 검증 및 실패 PATCH 저장소 불변성
  - mock API 자동 테스트
- 이번 기능에서 하지 않은 범위:
  - TanStack Query query/mutation hook
  - 보드·카드·검색·상세 UI
  - 낙관적 업데이트·캐시 롤백·pending guard
  - Undo, 가상화, 개발용 데이터 초기화 UI
  - 새 라이브러리 추가
  - 커밋

### 프롬프트 1 — 최초 지시

```text
AGENTS.md, docs/ASSIGNMENT.md, docs/PRD.md, docs/TECH\_SPEC.md,
docs/IMPLEMENTATION\_AND\_COMMIT\_PLAN.md, DECISIONS.md와 현재 코드를 읽어라.

이번 작업 scope는 `mock-api` 하나뿐이다.
연결 근거는 과제 §4 mock API 기술 제약이며, 구현·커밋 계획의 Commit 03을 따른다.

완료 기준:

- `Applicant`, `ApplicantStage`, `ApplicantRole`, `MoveApplicantStageRequest`, `ApiErrorBody` 타입과 `STAGES`를 구현한다.
- 최초 실행 시 결정적으로 생성되는 240건의 지원자 데이터를 `localStorage`에 저장·조회한다.
- `GET /api/applicants`와 `PATCH /api/applicants/:applicantId/stage`를 MSW로 구현한다.
- 모든 요청은 200\~800ms 지연을 가지며 기본 실패율은 약 15%다.
- 실패 여부는 저장 전에 판정하며, 실패한 PATCH는 `localStorage`를 변경하지 않는다.
- PATCH는 존재하지 않는 ID, 빈·잘못된 JSON, 객체가 아닌 body, 유효하지 않은 stage 타입·값을 저장 없이 적절한 400/404 오류로 반환한다.
- 브라우저 MSW worker와 테스트용 MSW Node server를 연결한다.
- 다음을 테스트한다: 결정적 seed, GET 성공 240건, GET 강제 실패 503, PATCH 성공 영속화, PATCH 실패 시 저장소 불변, 잘못된 PATCH 입력 거부, 지연 범위와 기본 실패율, 서로 다른 두 PATCH 성공 후 재조회 시 두 변경 유지.

이번 작업에서 하지 않을 것:

- TanStack Query query/mutation hook
- 보드·카드·검색·상세 UI
- 낙관적 업데이트·캐시 롤백·pending guard
- Undo, 가상화, 개발용 데이터 초기화 UI
- 새 라이브러리 추가
- 커밋 실행

제약:

- 기존 project-setup 범위와 문서를 보존한다.
- UI는 실제 `fetch('/api/...')` 경계를 사용할 수 있게 MSW handler를 구현한다.
- 저장소 함수는 UI와 분리하고, PATCH 성공 시 최신 `localStorage`를 읽어 대상 한 건만 동기적으로 갱신·저장한다.
- 랜덤 실패에 의존하는 flaky 테스트를 작성하지 않는다. 테스트에서는 handler override 또는 주입 가능한 설정으로 성공·실패를 결정적으로 제어한다.
- 불필요한 추상화·설정·의존성을 추가하지 않는다.
- `PROMPTS.md`의 실제 프롬프트·검증 기록은 내가 작성한다. 내용 초안만 제안할 수 있다.
- 커밋하지 않는다.

편집 전에 먼저 다음을 출력해라.

1. 현재 코드에서 재사용할 설정과 파일
2. 생성·수정할 파일과 각 책임
3. `GET → handler → localStorage` 및 `PATCH → 검증 → 실패 판정 → 저장` 흐름
4. 실패·경계 시나리오와 저장소 불변 조건
5. 먼저 작성하거나 확인할 테스트
6. 범위를 넘는 제안과 그 필요성

그 뒤 `mock-api` 범위만 최소 구현해라.

완료 후에는 다음을 실제 결과만으로 보고하고 멈춰라.

- 변경 파일과 diff 요약
- 실행한 관련 테스트 및 `npm run lint`, `npm run test`, `npm run build` 결과
- 수동 검증 항목
- 만족한 완료 기준
- 알려진 한계
- AI 생성 코드 중 수정·기각한 부분과 이유
- `PROMPTS.md`에 기록할 `AI 출력 요지` 초안
```

### AI 출력 요지

- `Applicant`, `ApplicantStage`, `ApplicantRole`, `MoveApplicantStageRequest`, `ApiErrorBody`, `STAGES`를 구현했다.
- index 기반으로 결정적 240건 seed를 생성하고 localStorage에 저장·조회·단계 변경을 구현했다.
- MSW로 GET/PATCH API를 구현하고 browser worker와 Node server에 같은 handler를 연결했다.
- 요청마다 200–800ms 지연을 적용하고, 기본 실패율 0.15와 `VITE_MOCK_FAILURE_RATE`의 0–1 제한을 구현했다.
- PATCH는 body·stage·ID를 검증하고, 실패 판정 뒤 성공한 경우에만 최신 저장 데이터의 대상 한 건을 동기적으로 저장한다.
- 결정적 seed, GET 성공·실패, PATCH 성공·실패, 입력 오류, 동시 PATCH 유지, 손상 저장소 복구, 환경 실패율을 테스트했다.

### 리뷰 / 검증

#### 1. 코드 정독

- 최초 구현에서 MSW Node server가 상대 route를 매칭하지 않아 실제 fetch 테스트가 실패했다. Node와 browser 모두에서 매칭되도록 `*/api/...` route로 수정했다.
- 생성된 MSW worker의 vendor lint 경고는 worker를 수정하지 않고 lint 대상에서 제외했다.
- 후속 리뷰에서 다음 문제를 발견해 수정했다.
  - 저장소 스키마 검증이 `id`, `stage` 문자열만 확인해 필수 필드 누락·허용되지 않은 role/stage를 통과시켰다.
  - 빈 localStorage에서 강제 실패 PATCH가 ID 검증 중 seed를 저장해 저장소 불변 조건을 어겼다.
  - README에 안내된 `VITE_MOCK_FAILURE_RATE=0/1`이 실제 failure 판정에 연결되지 않았다.
- 전체 목록 snapshot 복원, query hook, UI, reset UI, 추가 상태 라이브러리는 이번 scope에서 기각했다.

#### 2. 자동 검증

- RED 확인:
  - 빈 저장소에서 강제 실패 PATCH 후 저장 키가 생성되는 문제를 재현했다.
  - name, role, stage 등 손상된 저장 데이터가 그대로 반환되는 문제를 재현했다.
  - 실패율 resolver 부재를 재현했다.
- 테스트 범위:
  - 결정적 seed
  - GET 240건 성공 및 강제 503
  - PATCH 성공 영속화, 일반 실패·최초 실패의 저장소 불변
  - 빈·잘못된 JSON, 객체가 아닌 body, 유효하지 않은 stage, 존재하지 않는 ID 거부
  - 두 PATCH 성공 뒤 재조회 시 두 변경 유지
  - 손상된 Applicant 필드와 허용되지 않은 role·stage의 seed 복구
  - 실패율 기본값·0·1·음수·1 초과·비숫자
  - `VITE_MOCK_FAILURE_RATE=0/1` 설정 뒤 module reload한 `shouldMockApiFail()` 결과
- 실제 실행 결과:
  - `npm run lint` 통과
  - `npm run test` 통과 — 5 files, 35 tests
  - `npm run build` 통과
  - `git diff --check` 통과
- build는 500kB 초과 chunk 경고를 출력했다. mock-api scope에서는 code-splitting을 추가하지 않았다.

#### 3. 수동 검증

- 사용자 보고:
  - `VITE_MOCK_FAILURE_RATE=0`과 `1`을 각각 설정하고 dev server를 재시작했다.
  - 브라우저 콘솔의 `fetch('/api/applicants')`가 각각 200과 503을 반환하는 것을 확인했다.
- 미검증:
  - API 호출 UI가 아직 없어 UI 상태에서의 성공·실패 표시는 검증하지 않았다.

#### 4. 최종 판단

- 수정 후 채택.
- 확인한 범위:
  - mock API HTTP 계약, localStorage 영속화, 입력 오류, 실패 PATCH 불변성, 손상 저장소 복구, 결정적 실패 제어.
- 남은 위험:
  - 다음 UI 범위에서 query hook·낙관적 업데이트와 결합한 브라우저 동작을 검증해야 한다.

### 후속 프롬프트 2 — 개발 명세와의 차이 리뷰

```markdown
개발 명세와 동일하지 않은 부분을 발견했다

- `mockDB.ts`의 스키마 검증이 불완전하다. id, stage 외에도 name, role, skill 등 누락된 데이터도 체크하여 모든 필수 필드 타입을 확인하고 허용 role을 확인한다
- 실패한 PATCH는 저장소를 변경하지 않는다는 개발 명세를 위반한다. 사용자가 앱을 처음 실행해 localStorage가 비어있는 경우를 테스트하여 이 경계를 확인하고 놓치지 않아야 한다
- 기본 실패율은 `VITE_MOCK_FAILURE_RATE ?? 0.15`이며 0\~1 범위로 제한해야 하는데, 브라우저에서 실패율을 고정할 방법이 없고 0.15로 고정되어 있어 테스트 내부에서만 실패율을 바꿀 수 있다. 사용자가 실패를 확인할 수 있는 환경인지 확인한다

코드 수정은 하지 않고 개선점 리뷰만
```

### 후속 출력과 추가 검증

- 리뷰에서 세 지적을 재현·확인했다.
- `mockDb.ts`는 id와 stage만 확인해 손상된 Applicant를 통과시켰다.
- 빈 localStorage에서 강제 실패 PATCH가 ID 검증 중 seed를 저장했다.
- `VITE_MOCK_FAILURE_RATE`는 README에만 기록되고 실제 failure 판정에는 연결되지 않았다.
- 이 단계에서는 사용자 요청대로 코드를 수정하지 않았다.

### 후속 프롬프트 3 — 수동 확인과 회귀 검토

```go
`VITE_MOCK_FAILURE_RATE` `0`/`1`을 설정하고 dev server 재시작 후 브라우저 콘솔의 `fetch('/api/applicants')`가 각각 200/503을 반환하는지 확인했다
빈 저장소 PATCH 불변성, 저장 데이터 런타임 검증, 실패율 범위 제한을 구현했고, 해당 테스트로 회귀를 감지하고 있는지 확인 필요
```

### 후속 출력과 추가 검증

- 사용자 보고의 브라우저 수동 확인을 기록했다.
- 빈 저장소 실패 PATCH, 저장소 런타임 검증, 실패율 범위 제한 테스트가 각각의 회귀를 감지하는지 확인했다.
- 당시 환경값과 `shouldMockApiFail()`의 실제 연결은 자동 테스트로 완전히 보장되지 않는다는 공백을 확인했다.

### 후속 프롬프트 4 — 환경값 module reload 테스트

```go
`VITE_MOCK_FAILURE_RATE`를 바꾼 상태로 모듈을 다시 불러와 `shouldMockApiFail()` 결과까지 확인하는 테스트를 추가해
```

### 후속 출력과 추가 검증

- `VITE_MOCK_FAILURE_RATE=0/1`을 설정한 뒤 module cache를 비우고 `mockConfig`를 다시 import하는 테스트를 추가했다.
- 난수 0.5에서 `0`은 실패하지 않고 `1`은 실패하는 것을 확인했다.
- `npm run lint`, `npm run test`, `npm run build`, `git diff --check`를 실행했다.
- 최종 결과: lint 통과, 테스트 5 files / 35 tests 통과, build 통과. build는 500kB 초과 chunk 경고만 출력했다.

### 연결 커밋

- 메시지:

  ```
  feat(mock-api): 지원자 조회·단계 저장과 지연·실패·영속화 구현

  - MSW GET/PATCH와 localStorage 기반 240건 seed를 추가해 실제 fetch 경계를 유지
  - 실패를 저장 전에 판정하고, 최초 실패 PATCH도 저장소를 초기화하지 않도록 보완
  - 손상된 저장 데이터 복구와 VITE_MOCK_FAILURE_RATE 0~1 제어를 추가
  - AI 초안의 상대 MSW route가 Node에서 매칭되지 않아 origin wildcard route로 수정
  ```

- 해시: ab948cb
- AI 초안 수정 요약: Node MSW route 매칭, 저장소 런타임 검증, 최초 실패 PATCH 불변성, 환경 실패율 연결을 보완했다.

## [board-layout] 채용 단계 컬럼과 보드 기본 레이아웃 구현

### 목표 / 수용 기준

- 연결 요구사항: FR-01
- 이번 기능에서 완료한 범위:
  - `STAGES` 기반 5개 단계 컬럼과 페이지 헤더
  - 단계명·카운트 자리·heading/section 구조
  - 보드 영역 전용 가로 스크롤
  - 키보드 포커스 가능한 이름 있는 보드 영역
- 이번 기능에서 하지 않은 범위:
  - 지원자 조회, 카드 렌더링, 실제 카운트 계산
  - 검색·필터, 상세 보기, 단계 이동, 낙관적 업데이트
  - mock API·도메인 모델 수정, 새 라이브러리 추가, 커밋

### 프롬프트 1 — 최초 지시

```text
AGENTS.md, docs/PRD.md, docs/TECH\_SPEC.md,
docs/IMPLEMENTATION\_AND\_COMMIT\_PLAN.md, PROMPTS.md와 현재 코드를 읽어라.

이번 작업 scope는 board-layout 하나뿐이다.
연결 요구사항은 FR-01이다.

완료 기준:

- 서류검토, 면접, 처우협의, 최종합격, 불합격의 5개 단계 컬럼을 정해진 순서로 표시한다.
- 각 컬럼은 단계명, 현재 표시 수의 자리, 의미 있는 heading/section 구조를 가진다.
- 화면이 좁을 때 페이지 전체가 아니라 보드 영역만 가로 스크롤된다.
- 페이지 헤더를 제공한다.
- 기존 mock-api의 stage 상수·메타데이터가 있으면 재사용한다.

이번 작업에서 하지 않을 것:

- 지원자 조회, 카드 렌더링, 실제 카운트 계산
- 검색·필터, 상세 보기, 단계 이동, 낙관적 업데이트
- 새 라이브러리 추가
- mock API·도메인 모델 수정
- 커밋 실행

편집 전에 다음을 출력해라.

1. 현재 코드에서 재사용할 부분
2. 생성·수정할 파일과 책임
3. 레이아웃·스크롤 동작 방식
4. 확인할 접근성·반응형 시나리오
5. 먼저 실패를 확인할 테스트 또는 재현 시나리오
6. 범위를 넘는 제안

그 뒤 이번 scope의 최소 구현만 수행해라.
완료 후 변경 파일, diff 요약, 실제 실행한 검증 명령과 결과,
수동 검증 항목, 알려진 한계를 보고하고 멈춰라.
PROMPTS.md를 수정하거나 커밋하지 마라.
```

### AI 출력 요지

- 기존 `STAGES`를 재사용해 정해진 순서의 5개 컬럼을 렌더링했다.
- 페이지 header와 각 단계의 `section`·`h2`·`0명` count 자리를 추가했다.
- 최소 너비 grid를 가로 overflow wrapper 안에 두어 좁은 화면에서는 보드만 스크롤되게 했다.
- 리뷰 후 보드 wrapper에 `role="region"`, `aria-label="채용 단계 보드"`, `tabIndex={0}`을 추가했다.
- 새 의존성·지원자 조회·카드·실제 카운트 계산은 추가하지 않았다.

### 프롬프트 2 — 미커밋 diff 리뷰

```text
현재 미커밋 diff를 읽기 전용으로 리뷰해라.
대상 scope는 board-layout이고 요구사항은 FR-01이다.

우선순위:

1. 다섯 단계의 누락·순서 오류
2. 보드 영역이 아닌 페이지 전체에 가로 스크롤이 생기는 문제
3. semantic HTML, heading/section 구조, 키보드 접근성 문제
4. 이후 card-list와 실제 카운트를 붙이기 어렵게 만드는 불필요한 결합
5. 불필요한 추상화, 의존성, 범위 밖 코드
6. 테스트가 통과해도 놓칠 수 있는 반례

각 지적은 아래 형식으로 작성해라.

- 심각도: blocker / major / minor
- 파일과 코드 위치
- 재현 시나리오
- 왜 문제인지
- 최소 수정안

추측은 추측이라고 표시하고, 스타일 취향만으로 지적하지 마라.
파일을 수정하지 마라.
```

### 리뷰 결과와 후속 프롬프트 3 — 수정 승인

```text
수정안 모두 승인. 코드 수정만
- scope는 board-layout 그대로다.
- 지원자 조회·카드·검색·단계 이동 기능을 추가하지 마라.
- 새 의존성을 추가하지 마라.
- 리뷰에서 확인되지 않은 리팩터링을 하지 마라.
- 수정 후 관련 테스트와 npm run lint, npm run test, npm run build를 실제 실행하고 결과를 보고한 뒤 멈춰라.
- 커밋하지 마라.
```

### 리뷰 / 검증

#### 1. 코드 정독·리뷰

- blocker·major는 발견하지 못했다.
- 보드 스크롤 wrapper가 키보드 포커스를 받지만 이름·역할이 없어 목적을 알기 어려운 minor를 발견했다.
- `role="region"`과 `aria-label="채용 단계 보드"`를 추가했다.
- 기존 테스트가 보드 전용 스크롤 wrapper와 내부 grid 구조를 보호하지 않는 minor를 발견했다.
- 보드 landmark와 `boardViewport` → `board` 구조를 확인하는 테스트를 추가했다.
- landmark 추가로 전체 `region` 수가 6개가 되자, 기존 테스트의 “모든 region은 컬럼” 가정을 `aria-labelledby="stage-*"` 컬럼만 선택하도록 보정했다.

#### 2. 자동 검증

- RED 확인:
  - 5개 stage column `region`이 없다는 이유로 focused 테스트가 실패했다.
  - 이름 있는 `채용 단계 보드` region이 없다는 이유로 후속 focused 테스트가 실패했다.
- 실제 실행 결과:
  - `npm run test -- src/App.test.tsx` 통과 — 1개 파일, 2개 테스트
  - `npm run lint` 통과
  - `npm run test` 통과 — 5개 파일, 36개 테스트
  - `npm run build` 통과
  - `git diff --check` 통과
- build는 500kB 초과 chunk 경고를 출력했다. 이번 scope에서는 code-splitting을 추가하지 않았다.

#### 3. 브라우저 자동 확인

- 360×800 viewport에서 다음을 확인했다.
  - 5개 단계 heading과 각 `0명` 자리
  - 각 section이 내부 heading으로 이름 연결됨
  - 보드 wrapper의 `tabindex="0"`
  - 보드 영역은 가로 스크롤 가능하고 페이지 전체는 수평 overflow가 없음
- 수동 브라우저 검증: 검증
- 콘솔 오류 여부: 검증

#### 4. 알려진 한계

- 카운트는 의도적으로 고정 `0명`이다.
- 실제 지원자 조회·단계별 카드·필터 결과 기반 count 계산은 후속 `card-list` scope에서 구현해야 한다.

### 연결 커밋

- 메시지:

  ```text
  feat(board-layout): 채용 단계 컬럼과 보드 기본 레이아웃 구현

  - STAGES 메타데이터를 재사용해 5개 단계 컬럼의 순서와 라벨을 일관되게 렌더링
  - 페이지 header와 section·heading·카운트 자리를 추가해 FR-01의 기본 구조를 구성
  - 최소 너비 grid를 보드 전용 가로 스크롤 영역에 배치하고 이름 있는 landmark를 추가
  - 컬럼 순서와 보드 viewport/grid 구조를 테스트로 보호
  ```

- 해시: `47a0fde`

## [card-list] 지원자 조회와 단계별 카드 표시 구현

### 목표 / 수용 기준

- 연결 요구사항: FR-02, FR-01의 컬럼 카운트 표시
- 완료 범위: GET 조회·TanStack Query cache, stage별 순수 그룹화, 카드 필수 정보·컬럼 카운트, 명시적 조회 재시도
- 제외 범위: PATCH·이동·낙관적 업데이트·필터·상세·카드 클릭·mock API/저장소 변경·새 라이브러리·커밋

### 프롬프트 1 — 최초 지시

```text
AGENTS.md와 docs/ASSIGNMENT.md, docs/PRD.md, docs/TECH\_SPEC.md,
docs/IMPLEMENTATION\_AND\_COMMIT\_PLAN.md, DECISIONS.md, PROMPTS.md 및 최근 커밋과 현재 코드를 읽어라.

이번 작업 scope는 card-list 하나뿐이다.
연결 요구사항은 FR-02이며, FR-01의 컬럼 카운트 표시와 연결된다.

완료 기준:

- GET /api/applicants로 지원자 목록을 조회한다.
- 각 지원자는 자신의 현재 stage 컬럼에 정확히 한 번 표시된다.
- 카드에 이름, 직무, 지원일(YYYY.MM.DD), 현재 단계가 표시된다.
- 각 컬럼 카운트가 표시된 카드 수와 일치한다.
- 기존 STAGES와 Applicant 타입을 재사용한다.
- 단계별 그룹화처럼 핵심 변환이 필요하면 순수 함수로 두고 관련 테스트를 작성한다.

이번 작업에서 하지 않을 것:

- 단계 이동, PATCH 연결, 낙관적 업데이트, pending 처리
- 검색·직무 필터
- 상세 패널과 카드 클릭 동작
- 로딩·조회 오류·전체 빈 상태 UI
- mock API 계약·handler·seed·저장소 변경
- 범위 밖 리팩터링, 새 라이브러리, 커밋

편집 전에 다음을 출력해라.

1. 현재 코드에서 재사용할 부분
2. 생성·수정할 파일과 각각의 책임
3. 조회부터 컬럼·카드 렌더링까지의 데이터 흐름
4. 실패·경계 시나리오
5. 먼저 작성하거나 확인할 테스트
6. 요구사항을 넘는 제안과 필요성

계획 뒤 card-list 범위만 최소 구현하라.
완료 후 변경 파일, diff 요약, 실제 실행한 테스트와 npm run lint/test/build 결과,
수동 브라우저 검증 여부와 미검증 항목을 보고하고 멈춰라.
커밋하거나 PROMPTS.md의 리뷰/검증 사실을 추정해 작성하지 마라.
```

### 후속 프롬프트 2 — 미커밋 diff 리뷰

```text
현재 브랜치의 미커밋 diff를 리뷰해라. 파일은 수정하지 마라.

대상 scope는 card-list이고 연결 요구사항은 FR-02다.
AGENTS.md, PRD, TECH\_SPEC, IMPLEMENTATION\_AND\_COMMIT\_PLAN,
현재 코드와 최근 커밋을 먼저 읽어라.

우선순위:

1. 지원자 조회·단계별 배치·카운트의 요구 누락 또는 잘못된 해석
2. 카드의 이름·직무·지원일·현재 단계 불일치
3. API, mock 저장소, 단계 이동, 상세 보기 등 다음 scope의 선행 구현
4. 날짜 처리와 단계 그룹화의 경계 사례
5. semantic HTML·키보드 접근성·중첩 인터랙션 문제
6. 불필요한 추상화·의존성·미사용 코드
7. 테스트가 통과해도 놓치는 반례

각 지적은 아래 형식으로 작성해라.

- 심각도: blocker / major / minor
- 파일과 코드 위치
- 재현 시나리오
- 왜 문제인지
- 최소 수정안

문제가 없으면 요구사항별 확인 근거와 남은 미검증 항목을 구분해라.
추측은 추측이라고 표시하고, 스타일 취향만으로 지적하지 마라.
```

### 후속 프롬프트 3 — 조회 재시도 개선

```text
사용자가 명시적 재시도를 함으로써 목록 표시할 수 있도록 수정안대로 개선 후 재리뷰
```

### AI 출력 요지

- `useApplicantsQuery`로 `GET /api/applicants`를 TanStack Query cache에 연결했다.
- `groupApplicantsByStage`가 모든 `STAGES`를 초기화하고 지원자를 stage별로 한 번씩 배치한다.
- 기존 컬럼에서 카드와 실제 카운트를 렌더링하고, 이름·직무·`YYYY.MM.DD` 지원일·현재 단계를 표시했다.
- `StageColumn`, `ApplicantCard` JSX 시작 지점에 사용자 요청의 설명 주석을 추가했다.
- `retry: false`와 `다시 시도` 버튼의 `refetch()`를 추가했다.
- 새 라이브러리, PATCH·이동·상세·필터, mock API·저장소 변경은 추가하지 않았다.

### 리뷰 / 검증

#### 1. 코드 정독·리뷰

- 채택:
  - 기존 `STAGES`, `Applicant`, TanStack Query provider와 MSW GET handler를 재사용했다.
  - 그룹화를 순수 함수로 분리하고, 빈 stage와 지원자 단 한 번 배치를 테스트했다.
  - 카드 현재 단계는 배치된 컬럼의 label을 사용해 컬럼과 모순되지 않게 했다.
  - 사용자 요청에 따라 실제 컴포넌트 추출 대신 JSX 책임 주석만 추가했다.
- 수정:
  - ISO timestamp에 `replaceAll('-', '.')`만 적용하면 시간 부분이 남았다. `slice(0, 10)` 뒤 점 표기로 바꾸고 ISO fixture 회귀 테스트를 추가했다.
  - diff 리뷰에서 production query가 기본 자동 재시도를 상속한다는 major를 발견했다. PRD·TECH_SPEC의 `retry: 0` 기준에 맞춰 `retry: false`를 추가했다.
  - 사용자 지시에 따라 실패 후 자동 요청 없이 `다시 시도` 버튼을 눌러야 목록이 다시 조회되는 흐름을 구현·테스트했다.
  - 전역 화면 검색이 이전 렌더와 섞이는 것을 확인해 새 비동기 시나리오는 render container 안에서 조회하도록 보정했다.
  - `Object.fromEntries` 단언이 TypeScript build 오류를 일으켜 `STAGES` 순회 초기화로 교체했다.
- 기각:
  - 별도 `ApplicantCard`·`StageColumn` 파일, 추가 상태 라이브러리, mock API/저장소 수정, PATCH·이동·상세·필터: 이번 scope에 불필요하거나 범위 밖이다.
  - 조회 자동 재시도: 사용자의 명시적 재시도 기준과 충돌하므로 제거했다.

#### 2. 자동 검증

- RED 확인:
  - selector 모듈 부재, ISO timestamp 날짜 표기, 503 뒤 재시도 버튼 부재를 각각 재현했다.
- 실제 실행 결과:
  - `npm run test -- src/features/recruitment-board/model/applicantSelectors.test.ts src/App.test.tsx` 통과 — 2개 파일, 4개 테스트.
  - `npm run test -- src/App.test.tsx`에서 명시적 재시도 RED를 확인했다.
  - `npm run test -- src/App.test.tsx src/features/recruitment-board/model/applicantSelectors.test.ts` 통과 — 2개 파일, 5개 테스트.
  - `npm run lint` 통과.
  - `npm run test` 통과 — 6개 파일, 39개 테스트.
  - `npm run build` 통과.
  - `git diff --check` 통과.
- build는 500kB 초과 chunk 경고를 출력했다. 이번 scope에서는 code-splitting을 추가하지 않았다.

#### 3. 수동 검증

- 사용자 직접 수동 브라우저 검증 보고: 검증.
- 카드 클릭·상세 열기, 조회 실패 문구·접근 가능한 오류 안내, 로딩·전체 빈 상태: 검증 및 후속 scope.

#### 4. 알려진 한계

- `다시 시도` 버튼만 사용자 지시로 최소 추가했다. 조회 오류 설명과 전체 상태 UI는 `ui-states` scope에서 완성한다.
- 카드 본문 실행으로 상세를 여는 FR-02 수용 기준은 `detail-panel` scope에 남아 있다.
- 검색·직무 필터가 적용된 카운트 갱신은 `search-filter` scope에 남아 있다.

### 연결 커밋

- 메시지:

  ```text
  feat(card-list): 지원자 조회와 단계별 카드 표시 구현

  - GET 응답을 TanStack Query cache로 읽고 STAGES 기준 순수 그룹화로 컬럼별 카드를 렌더링
  - 기존 Applicant 타입과 단계 상수를 재사용해 API·카드·컬럼의 stage 계약을 일관되게 유지
  - AI 초안의 ISO 날짜 표기와 자동 조회 재시도를 수정하고, 불필요한 컴포넌트 분리·상태 라이브러리·범위 밖 기능은 기각
  ```

- 해시: `04911c5`

## [stage-move] 명시적 단계 변경과 mock API 저장

### 목표 / 수용 기준

- 연결 요구사항: FR-03
- 완료 범위: 현재 단계를 제외한 select, 이동 button, PATCH 요청, 성공 응답의 TanStack Query cache 병합, 실패 피드백, mock 저장소 영속성 및 성공 응답 전 화면 유지 테스트
- 제외 범위: 낙관적 업데이트·rollback, pending guard·동시 이동, 검색·필터·상세·전역 상태 UI, 새 라이브러리, 커밋

### 프롬프트 1 — 최초 지시

```text
mock-api·card-list 완료 확인 후
AGENTS.md와 docs/PRD.md, docs/TECH_SPEC.md,
docs/IMPLEMENTATION_AND_COMMIT_PLAN.md, DECISIONS.md, PROMPTS.md 및 현재 코드를 읽어라.

이번 작업 scope는 stage-move 하나뿐이다.
연결 요구사항은 FR-03이다.

완료 기준:
- 카드마다 현재 단계를 제외한 다른 단계를 선택할 수 있다.
- 선택한 단계로 이동 버튼을 실행할 수 있다.
- PATCH /api/applicants/:id/stage를 호출한다.
- API 성공 뒤 반환된 Applicant를 TanStack Query cache에 반영한다.
- 새로고침 뒤에도 성공한 이동 결과가 유지된다.
- 현재 단계 제출은 불가능하다.
- 실패 시 저장소는 변경되지 않고, 사용자가 인지할 수 있는 기본 피드백을 제공한다.

이번 작업에서 하지 않을 것:
- 낙관적 업데이트와 실패 롤백
- 동일 카드 pending guard 및 동시 이동 처리
- 검색·필터, 상세 패널, 로딩·오류·빈 상태 전반
- 범위 밖 리팩터링, 새 라이브러리 추가, 커밋

제약:
- Applicant 목록은 TanStack Query cache를 단일 진실 공급원으로 사용한다.
- 명시적 stage select와 이동 button을 사용한다.
- 현재 stage는 select 옵션에서 제외한다.
- 성공 전 화면 변경은 다음 optimistic-update scope에서 구현한다.
- 카드 상세 버튼과 이동 컨트롤을 중첩하지 않는다.
- 기존 mock API·도메인 타입·stage 상수를 재사용한다.
- 관련 없는 파일은 수정하지 않는다.

편집 전에 다음을 출력해라.
1. 재사용할 현재 코드
2. 수정·생성할 파일과 책임
3. 성공/실패 데이터 흐름
4. 현재 단계 제출, API 실패, 새로고침의 검증 시나리오
5. 먼저 실패를 확인할 테스트 또는 재현 시나리오
6. 범위를 넘는 제안

그 뒤 stage-move 범위만 최소 구현해라.
구현 후 변경 파일, diff 요약, 실제 실행한 명령과 결과, 수동 검증 항목,
알려진 한계를 보고하고 멈춰라. 커밋하지 마라.
```

### 후속 프롬프트 2 — 미커밋 diff 리뷰

```text
현재 브랜치의 미커밋 diff를 리뷰해라. 파일은 수정하지 마라.

대상 scope는 stage-move이고 연결 요구사항은 FR-03이다.

우선 확인할 사항:
1. PATCH /api/applicants/:id/stage 요청과 응답 병합이 정확한가
2. 현재 단계가 선택·제출될 수 없는가
3. 성공한 이동이 localStorage mock 저장소에 남아 새로고침 후 유지되는가
4. 실패 시 저장소가 변경되지 않는가
5. 성공 전 UI를 바꾸는 낙관적 업데이트가 섞이지 않았는가
6. TanStack Query cache 외에 지원자 목록 복제 상태가 생기지 않았는가
7. 카드 상세 컨트롤과 이동 컨트롤이 중첩되지 않았는가
8. 불필요한 의존성·추상화·범위 밖 변경이 없는가
9. 테스트가 통과해도 놓칠 반례가 있는가

각 지적은 아래 형식으로 작성해라.
- 심각도: blocker / major / minor
- 파일과 코드 위치
- 재현 시나리오
- 왜 문제인지
- 최소 수정안

지적할 문제가 없으면, 확인한 범위와 아직 검증하지 못한 범위를 구분해라.
```

### 후속 프롬프트 3 — 영속성과 비낙관적 이동 테스트 보강

```text
저장된 결과가 앱을 다시 열어도 남는가, 저장 성공 전에는 화면을 미리 바꾸지 않는가를 증명하는 테스트 보강이 필요하다
현재 stage-move 미커밋 diff는 유지하고, 테스트만 최소 보강해라.
파일 수정 전 변경 계획과 테스트 시나리오를 먼저 설명해라.

보완 목표는 두 가지다.

1. 실제 MSW PATCH handler와 localStorage를 사용하는 흐름에서:
   - 카드 이동 성공
   - 앱을 다시 렌더링하거나 새로고침과 같은 GET 재조회
   - 변경된 단계가 계속 보임
   을 확인하는 통합 테스트를 추가해라.

2. PATCH 응답을 지연시키는 테스트에서:
   - 이동 버튼 실행 직후 카드는 아직 기존 컬럼에 남아 있어야 한다.
   - PATCH 성공 응답 뒤에만 목표 컬럼으로 이동해야 한다.
   를 확인해라.

제약:
- optimistic update, rollback, pending guard, 새 라이브러리는 추가하지 마라.
- 실제 mock API handler와 TanStack Query cache를 사용해라.
- 테스트용 handler가 응답만 흉내 내고 localStorage를 우회하지 않게 해라.
- 기존 stage-move 범위 밖 리팩터링 금지.
- 구현 후 focused test, npm run lint, npm run test, npm run build 결과를 보고하고 멈춰라. 커밋하지 마라.
```

### AI 출력 요지

- 카드별 native select와 이동 form을 추가하고, 현재 단계는 option에서 제외했다.
- `PATCH /api/applicants/:id/stage` 성공 응답의 Applicant 한 건만 `['applicants']` Query cache에 병합했다.
- 실패 시 cache를 변경하지 않고 기본 `role="alert"` 피드백을 표시했다.
- 실제 MSW handler와 `localStorage`를 사용하는 재렌더링 영속성 테스트, 지연 PATCH 동안 기존 컬럼을 유지하는 테스트를 추가했다.

### 리뷰 / 검증

#### 1. 코드 정독·리뷰

- 유지:
  - 기존 mock API handler, Applicant 타입, STAGES, TanStack Query cache를 재사용했다.
  - 카드 목록 복제 state 없이 query 결과만 단계별로 렌더링했다.
- 기각:
  - `onMutate` 기반 낙관적 업데이트, rollback, pending guard, 동시 이동 제어, 새 라이브러리.
- 확인:
  - PATCH 성공 전에는 cache를 변경하지 않으며, 성공 콜백에서만 응답 엔티티를 병합한다.
  - 현재 단계는 select option에서 제외하고 submit handler도 방어한다.
  - 실제 handler의 실패는 저장 전 반환되므로 localStorage를 바꾸지 않는다.

#### 2. 자동 검증

- 최초 이동 UI 테스트는 이동 form이 없어 실패하는 것을 확인한 뒤 구현했다.
- 테스트 보강 첫 실행은 `getByRole(...).findByRole` 사용 오류와 정리 누락으로 실패했고, scoped query 호출과 테스트 후 정리로 수정했다.
- `npm run test -- src/App.test.tsx` 통과 — 8개 테스트.
- `npm run lint` 통과.
- `npm run test` 통과 — 6개 파일, 43개 테스트.
- `npm run build` 통과.
- `git diff --check` 통과.
- build는 500kB 초과 chunk 경고를 출력했으며, 이번 scope에서 code-splitting은 추가하지 않았다.

#### 3. 수동 검증

- 사용자 직접 수동 브라우저 검증 보고: 완료.

#### 4. 알려진 한계

- 현재 단계 외 모든 단계로의 이동을 허용한다. 다음 단계로만 제한하는 흐름은 확장·고도화 시 재검토한다.
- 성공 전 즉시 카드 이동, 실패 rollback, 동일 카드 pending guard와 동시 이동 처리는 `optimistic-update` scope에 남긴다.
- 카드 상세 버튼은 아직 없으며, 향후 추가돼도 이동 form과 중첩하지 않는다.

### 연결 커밋

- 예정 메시지:

  ```text
  feat(stage-move): 명시적 단계 변경과 mock API 저장

  - PATCH 요청으로 변경 단계를 mock 저장소에 영속화
  - 성공 응답을 Query cache에 반영
  - 낙관적 업데이트와 경쟁 상태 처리는 다음 scope로 분리
  ```

- 상태: 미커밋
- AI 초안 수정 요약: 응답만 흉내 낸 PATCH 테스트를 실제 MSW handler·localStorage 재조회 테스트로 보강했다.

## 기능 기록 템플릿

아래 블록을 기능마다 복사한다. 제출 전 빈 템플릿은 제거한다.

````md
## [feature-scope] 기능명

### 목표 / 수용 기준

- 연결 요구사항: FR-00
- 이번 기능에서 완료할 범위:
- 이번 기능에서 하지 않을 범위:

### 프롬프트 1 — 최초 지시

(실제 프롬프트 원문)

### AI 출력 요지

- 제안한 접근:
- 생성·수정한 주요 파일:
- 핵심 로직:

### 리뷰 / 검증

#### 1. 코드 정독

- 요구 누락:
- 잘못된 가정:
- 불필요하거나 이해하지 못한 코드:
- 유지한 부분과 이유:
- 수정·기각한 부분과 이유:

#### 2. 자동 검증

- 실행 명령:
- 실제 결과:
- 실패한 테스트와 원인:

#### 3. 수동 검증

- 재현 환경:
- 확인한 성공 시나리오:
- 확인한 실패·경계 시나리오:
- 실제 관찰 결과:

#### 4. 최종 판단

- 그대로 채택 / 수정 후 채택 / 기각:
- 내가 최종 책임지고 확인한 범위:
- 미검증 또는 남은 위험:

### 후속 프롬프트 2 — 수정 또는 리뷰 요청

(사용했다면 실제 원문)

### 후속 출력과 추가 검증

- 변경 내용:
- 추가로 발견한 문제:
- 최종 반영 내용:

### 연결 커밋

- 예정 메시지:

  ```text
  type(feature-scope): 요약

  - 무엇:
  - 왜:
  ```
````

- 상태: 미커밋
- AI 초안 수정 요약: 한 줄

````

## 좋은 리뷰 예시

```md
### 리뷰 / 검증

- AI 초안은 `onError`에서 전체 query snapshot을 복원했다. 서로 다른 카드 A/B 이동을 동시에 실행한 뒤 A만 실패시키는 테스트를 작성하자 B의 성공 상태도 사라졌다.
- 원인은 A 요청이 시작될 때의 오래된 전체 배열로 캐시를 덮어쓴 것이었다.
- 전체 snapshot rollback을 기각하고, `previousApplicant` 한 건만 context에 저장해 `replaceApplicant`로 복구하도록 수정했다.
- PATCH를 600ms 지연한 테스트에서 응답 전 목표 컬럼 이동을 확인했고, 503 응답 후 A만 원래 컬럼으로 돌아가며 B는 목표 컬럼에 남는 것을 확인했다.
- `npm run lint`, `npm run test`, `npm run build` 모두 통과했다.
````

## 피해야 할 리뷰 예시

```md
- AI가 잘 만들어 줘서 사용했다.
- 테스트해 보니 잘 된다.
- 코드를 검토했다.
```

위 문장은 무엇을 어떻게 검증했는지 재현할 수 없으므로 제출용 기록으로 부족하다.
