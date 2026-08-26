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

- 메시지:

  ```text
  feat(stage-move): 명시적 단계 변경과 mock API 저장

  - PATCH 요청으로 변경 단계를 mock 저장소에 영속화
  - 성공 응답을 Query cache에 반영
  - 낙관적 업데이트와 경쟁 상태 처리는 다음 scope로 분리
  ```

- 해시: `938dcb9`
- AI 초안 수정 요약: 응답만 흉내 낸 PATCH 테스트를 실제 MSW handler·localStorage 재조회 테스트로 보강했다.

## [prompt-record-automation] PROMPTS 자동 기록과 해시 일괄 동기화

### 목표 / 수용 기준

- 구현·수정·검증 뒤 별도 사용자 명령 없이 현재 scope의 `PROMPTS.md` 기록을 작성한다.
- 기능 작업 중 이전 scope 기록과 해시는 수정하지 않는다.
- `[submission-review]`에서 이전 기능의 대기 중인 해시를 한 번에 동기화한다.
- 예정 제목과 exact scope에 맞는 커밋이 하나가 아니면 추측하지 않고 중단한다.
- 자동 커밋은 추가하지 않고 기존 사용자 diff 검토·커밋 승인 규칙을 유지한다.

### 프롬프트 1 — 자동 기록 병목 개선 검토

매번 구현 및 수정, 검증까지하고 나서 프롬프트 업데이트를 수동으로 해야 한다는 것이 고민. 병목을 만들고 비효율을 발생시킨다고 판단됨. 프롬프트 정리를 자동화하는 로직 및 훅을 추가했음에도 제대로 사용되고 있지 않다
개선 제안해줘. 코드 수정 금지

### 프롬프트 2 — 동일 요청 재전송

매번 구현 및 수정, 검증까지하고 나서 프롬프트 업데이트를 수동으로 해야 한다는 것이 고민. 병목을 만들고 비효율을 발생시킨다고 판단됨. 프롬프트 정리를 자동화하는 로직 및 훅을 추가했음에도 제대로 사용되고 있지 않다
개선 제안해줘. 코드 수정 금지

### 프롬프트 3 — 별도 명령 없는 흐름 확인

이 경우, 내가 직접 명령하지 않는 구조가 가능한지

### 프롬프트 4 — 이전 scope backfill BLOCK 개선

또한 자동화를 사용하지 않고 프롬프팅만 했을 때 이전 커밋 기록을 반영하지 않고
종종 이전 커밋 기록을 업데이트한 채로 신규 기능을 커밋하고자 하면 해당 기능과 관련이 없다고 커밋 BLOCK 당함
개선점 제안

### 프롬프트 5 — 커밋·해시 자동화 분리 검토

커밋 해시 업데이트 및 커밋 자동화는 별도로 진행할 수 없는지

### 프롬프트 6 — 지침 수정 요청

PROMPTS 자동작성 및 여러 해시를 마지막에 한번에 동기화하기 위해 지침 수정

### AI 출력 요지

- 기존 hook은 프롬프트와 세션 ID만 수집하고 `prompt-record` 실행을 시작하지 않아 별도 명령이 필요하다고 분석했다.
- 기존 `prompt-record`가 이전 기능 backfill과 현재 기능 기록을 함께 제안해 단일-scope 커밋 규칙과 충돌한다고 확인했다.
- 기능 검증 뒤 현재 scope 기록을 자동 적용하고, 이전 해시는 `[submission-review]`에서 한 번에 동기화하도록 지침을 변경했다.
- 같은 scope의 커밋이 여러 개 존재할 수 있어 예정 제목과 exact scope가 모두 일치하는 단일 커밋만 허용하도록 보강했다.

### 리뷰 / 검증

#### 1. 지침 정독

- 유지:
  - hook이 전달한 단일 `PROMPT_LOG_SESSION_ID`만 읽는 fail-closed 계약
  - 실제 프롬프트 원문, 실행한 검증, 사용자 보고만 기록하는 증거 기준
  - 전체 diff 사용자 검토와 명시적 커밋 승인
- 수정:
  - 별도 명령 없이 검증 완료 후 `prompt-record`를 실행하도록 `AGENTS.md` 완료 조건에 추가
  - 별도 preview 승인 단계를 제거하고 전체 기능 diff 검토로 통합
  - 이전 기능 즉시 backfill을 제거하고 현재 scope 섹션만 수정
  - 최종 hash sync를 `[submission-review]` 전용 모드로 분리
- 기각·재작성:
  - 신규 기능 커밋에 이전 scope 해시를 섞는 방식은 단일-scope 규칙과 충돌해 제거했다.
  - 최초 exact scope 단독 매칭은 기존 `prompt-workflow` 커밋이 여러 개라 모호해져, 예정 제목과 scope 동시 매칭으로 수정했다.
  - 자동 커밋은 사용자 승인 계약과 별도 범위이므로 추가하지 않았다.

#### 2. 자동 검증

- RED:
  - 기존 계약 테스트가 `Feature record mode` 부재로 실패했다.
  - scope 단독 매칭의 모호성을 발견한 뒤 `planned commit subject` 계약 부재로 추가 실패를 확인했다.
  - 기존 지침을 읽은 독립 시나리오는 별도 승인과 이전·현재 두 섹션 수정을 요구해 단일-scope 충돌을 재현했다.
- GREEN:
  - `node --test .agents/skills/prompt-record/prompt-record.test.mjs`: 4개 테스트 통과.
  - `node --check .agents/skills/prompt-record/scripts/read-prompt-log.mjs`: 통과.
  - `git diff --check`: 통과.
  - `npm run lint`: 통과.
  - `npm run test`: 7개 파일, 47개 테스트 통과.
  - `npm run build`: 통과. 500kB 초과 chunk 경고는 유지됐다.
- 독립 시나리오 재검증:
  - 별도 사용자 명령·승인 없이 현재 scope만 기록하고, 이전 해시는 `[submission-review]`까지 건드리지 않는다고 판단했다.
  - `quick_validate.py`는 로컬 Python의 `yaml` 모듈 부재로 실행하지 못했다. frontmatter와 필수 필드는 정독 및 계약 테스트로 확인했다.

#### 3. 수동 검증

- 브라우저 동작과 무관한 지침 변경이므로 브라우저 검증은 수행하지 않았다.
- 사용자 diff 검토: 프롬프트 자동화 관련 항목만 커밋·푸시하도록 승인.

#### 4. 최종 판단

- 자동 검증 기준: 수정 후 채택 제안.
- 사용자 최종 판단: `optimistic-update` 미커밋 변경을 제외한 자동화 관련 항목의 커밋·푸시 승인.
- 남은 한계: `[submission-review]` 커밋 자신의 해시는 같은 커밋에 기록할 수 없어 최종 일괄 동기화 대상에서 제외한다.

### 연결 커밋

- 메시지:

  ```text
  chore(prompt-record-automation): 프롬프트 자동 기록과 해시 일괄 동기화 정리

  - 검증 완료 시 현재 scope 기록을 별도 명령 없이 같은 diff에 반영
  - 이전 기능 backfill을 제거하고 submission-review에서 대기 해시를 일괄 동기화
  - 예정 제목과 scope의 단일 커밋만 허용하는 계약 테스트로 BLOCK 재발 방지
  ```

- 해시: `93108e1`
- AI 초안 수정 요약: scope 단독 해시 매칭을 예정 제목과 scope 동시 매칭으로 좁혀 반복 scope의 모호성을 제거했다.

## [optimistic-update] 즉시 단계 반영과 엔티티 단위 실패 롤백

### 목표 / 수용 기준

- 연결 요구사항: FR-04, FR-08
- 이번 기능에서 완료한 범위: TanStack Query cache 기반 낙관적 stage 변경, 대상 엔티티 단위 rollback·서버 응답 병합, 동일 ID synchronous pending guard, 다른 ID 병렬 이동, 접근 가능한 실패 알림과 관련 테스트
- 이번 기능에서 하지 않은 범위: Undo, 검색·필터, 상세 패널, 조회 상태 UI, 가상화·사전 성능 최적화, mutation 뒤 전체 refetch, 새 상태 관리 라이브러리, 커밋

### 프롬프트 1 — 최초 지시

```text
stage-move 완료 검증 후
AGENTS.md와 docs/PRD.md, docs/TECH_SPEC.md,
docs/IMPLEMENTATION_AND_COMMIT_PLAN.md, DECISIONS.md, PROMPTS.md 및 현재 코드를 읽어라.

이번 작업 scope는 optimistic-update 하나뿐이다.
연결 요구사항은 FR-04와 FR-08이다.

완료 기준:
- 단계 이동 직후 API 응답 전에도 카드가 목표 컬럼에 보인다.
- PATCH 실패 시 실패한 지원자 한 건만 이전 stage로 복원한다.
- PATCH 성공 시 서버가 반환한 Applicant를 TanStack Query cache에 병합한다.
- 동일 지원자의 이동 요청은 처리 중 추가 실행되지 않는다.
- 버튼 disabled만 믿지 않고 synchronous pending guard로 빠른 이중 실행도 차단한다.
- 서로 다른 지원자는 동시에 이동할 수 있다.
- 실패 메시지는 사용자가 인지할 수 있는 role="alert"로 제공한다.
- 전체 목록 snapshot rollback을 사용하지 않는다.
- 낙관적 성공, 실패 롤백, A 실패/B 성공, 동일 카드 중복 차단을 테스트한다.

이번 작업에서 하지 않을 것:
- Undo
- 검색·필터, 상세 패널, 조회 상태 UI
- 1,000건 가상화 또는 측정 전 성능 최적화
- mutation 완료 후 무조건 전체 목록 refetch
- 새 상태 관리 라이브러리, 범위 밖 리팩터링, 커밋

제약:
- 지원자 목록은 TanStack Query cache가 유일한 진실 공급원이다.
- onMutate에서 이전 전체 배열이 아니라 previousApplicant 한 건만 context에 저장한다.
- onError에서는 해당 지원자만 복원한다.
- onSuccess에서는 서버 응답 Applicant 한 건만 병합한다.
- onSettled에서 pending ref와 렌더링용 pending 상태에서 해당 ID만 제거한다.
- 동일 ID는 pending ref에 먼저 즉시 추가한 뒤 mutation을 실행한다.
- 다른 ID는 막지 않는다.
- 기존 stage-move의 명시적 select + 이동 button UI를 재사용한다.
- 관련 없는 파일은 수정하지 않는다.

편집 전에 다음을 출력해라.
1. 현재 코드에서 재사용할 query, mutation, API, 카드 이동 UI
2. 수정·생성할 파일과 각 책임
3. pending guard부터 onMutate/onError/onSuccess/onSettled까지의 알고리즘
4. API 실패 전 저장소 불변, A 실패/B 성공, 동일 카드 빠른 두 번 실행의 경계 시나리오
5. 먼저 실패를 확인할 테스트 계획
6. 범위를 넘는 제안과 제외 이유

그 뒤 optimistic-update 범위만 최소 구현해라.
구현 후 변경 파일, diff 요약, 실제 실행한 명령과 결과, 수동 검증 항목,
알려진 한계를 보고하고 멈춰라. 커밋하지 마라.
```

### 후속 프롬프트 2 — 미커밋 diff 리뷰

```text
현재 브랜치의 미커밋 diff를 리뷰해라. 파일은 수정하지 마라.

대상 scope는 optimistic-update이고 연결 요구사항은 FR-04, FR-08이다.

우선순위:
1. onMutate가 API 응답 전 대상 카드만 목표 stage로 바꾸는가
2. onError가 전체 목록이 아닌 previousApplicant 한 건만 복원하는가
3. A 실패가 B의 성공 또는 pending 상태를 덮지 않는가
4. 동일 카드의 빠른 두 번 실행이 PATCH 한 번으로 제한되는가
5. 다른 카드의 요청은 병렬로 가능한가
6. pending guard가 렌더링 전 이벤트에도 동작하는 synchronous ref 기반인가
7. onSuccess가 서버 응답을 병합하는가
8. onSettled가 실패·성공 모두에서 pending ID를 해제하는가
9. 실패 메시지가 role="alert"로 접근 가능한가
10. 무조건 refetch, 목록 복제 상태, 불필요한 의존성·추상화가 없는가
11. 테스트가 통과해도 놓칠 반례가 있는가

각 지적은 아래 형식으로 작성해라.
- 심각도: blocker / major / minor
- 파일과 코드 위치
- 재현 시나리오
- 왜 문제인지
- 최소 수정안

문제가 없으면, 확인한 범위와 아직 검증하지 못한 범위를 분리해라.
```

### 후속 프롬프트 3 — 리뷰 지적 수정

```text
방금 optimistic-update 리뷰에서 확인된 blocker와 major를 최소 수정안으로 수정해라.

이번 작업은 FR-04, FR-08 범위를 벗어나지 않는다.
Undo, 검색·필터, 상세 패널, 가상화, 전역 상태 라이브러리는 추가하지 마라.

수정 전에 각 지적의 원인과 최소 수정 파일을 짧게 제시해라.
수정 후 아래 검증을 실제로 실행하고 결과를 보고해라.

- 낙관적 이동 성공 테스트
- PATCH 실패 후 엔티티 단위 롤백 테스트
- A 실패/B 성공 동시 이동 테스트
- 동일 카드 빠른 두 번 실행 시 PATCH 1회 테스트
- 서로 다른 카드 동시 이동 테스트
- npm run lint
- npm run test
- npm run build

변경 파일, 수정한 지적, 실제 명령 결과, 남은 미검증 사항을 보고한 뒤 멈춰라.
커밋하지 마라.
```

### 후속 프롬프트 4 — 수동 브라우저 검증 항목

```text
optimistic-update 구현의 수동 브라우저 검증 항목만 정리해라.
파일은 수정하지 마라.

아래 각각에 대해 조작 순서와 기대 결과를 한 줄씩 작성해라.

- 지연된 PATCH 응답 전 카드가 목표 컬럼으로 즉시 이동함
- PATCH 강제 실패 후 해당 카드만 원래 컬럼으로 복원됨
- A는 실패, B는 성공할 때 B는 목표 컬럼에 남음
- 동일 카드 이동 버튼을 빠르게 두 번 실행해도 요청이 한 번만 발생함
- 서로 다른 두 카드는 동시에 이동 가능함
- pending 중 이동 컨트롤이 비활성화되고 처리 상태가 전달됨
- 실패 메시지가 화면과 스크린리더에 전달됨
- 성공 뒤 새로고침해 mock 저장소와 화면이 일치함

실제로 수행하지 않은 항목은 검증 완료로 표시하지 마라.
```

### 후속 프롬프트 5 — 수동 결과와 스테이징 요청

```text
브라우저 검증 항목 결과 안내

강제실패 '단계 이동을 저장하지 못했습니다.' 확인하였고\
PATCH 강제 실패 후 실패 알림을 확인했고, 최종적으로 카드는 원래 컬럼에 있었다. 즉시 목표 컬럼으로 이동했다가 복원되는 중간 프레임은 육안으로 분리해 확인하지 못했다.

A 실패/B 성공은 단계 저장 중 메세지 뜨고, 저장하지 못했다는 메세지 확인했다.

동일 카드 중복은 PATCH 요청 한번만 실행 확인하였다.

서로 다른 카드 병렬도 각각 독립적으로 이동하는 것을 확인했다.

pending UI, 실패알림, 성공 영속성까지 완료했다
```

### AI 출력 요지

- `useMoveApplicantStage` hook에 PATCH mutation lifecycle을 모아, `onMutate`에서 대상 Applicant만 즉시 stage 교체하고 `previousApplicant` 한 건만 context에 저장했다.
- `onError`와 `onSuccess`는 각각 이전 엔티티와 서버 응답 엔티티만 cache에 병합하며, 전체 배열 snapshot rollback이나 settled refetch를 추가하지 않았다.
- ref와 렌더링용 Set을 함께 써 같은 ID는 동기적으로 차단하고, 다른 ID는 독립적으로 pending 처리했다.
- 최초 테스트가 응답 전 상태와 A/B 응답 순서를 결정적으로 증명하지 못한다는 리뷰를 반영해, deferred PATCH 응답 기반 통합 테스트로 보강했다.

### 리뷰 / 검증

#### 1. 코드 정독·리뷰

- 유지:
  - 지원자 목록 원본은 `['applicants']` TanStack Query cache만 사용한다.
  - `replaceApplicant`와 `moveApplicantOptimistically`는 불변 순수 함수이며 대상 외 엔티티를 그대로 유지한다.
  - `move()`는 mutation 실행 전 `pendingIdsRef`에 ID를 즉시 넣어 렌더 이전의 중복 submit도 막는다.
- 수정:
  - 지연 시간만 사용해 성공을 확인하던 테스트를 deferred 응답으로 변경해, 응답 resolve 전에 목표 컬럼과 pending 상태를 확인했다.
  - A/B 테스트는 B를 pending으로 둔 다음 A 실패를 resolve하고, A만 복원되는지와 B의 pending·성공 상태를 순서대로 확인하도록 변경했다.
  - 성공·실패 모두 `onSettled` 뒤 form의 `aria-busy="false"`를 확인하도록 보강했다.
- 기각:
  - 전체 목록 snapshot rollback, 무조건 refetch, 요청 큐, Undo, 별도 전역 상태 라이브러리.

#### 2. 자동 검증

- RED:
  - `applicantCache` 모듈이 없는 상태와 기존 비낙관적 지연 기대 때문에 focused test가 실패하는 것을 확인했다.
  - 테스트 보강 중 fixture 이름과 selector 불일치로 focused test가 실패했으며, production 동작이 아닌 test selector를 정정했다.
- GREEN:
  - `npm run test -- src/features/recruitment-board/model/applicantCache.test.ts src/App.test.tsx`: 12개 테스트 통과.
  - `npm run test -- src/App.test.tsx`: 10개 테스트 통과.
  - 낙관적 성공, 실패 rollback, A 실패/B 성공, 동일 카드 중복 차단 focused test를 각각 실행해 모두 1개 테스트 통과.
  - `npm run lint`: 통과.
  - `npm run test`: 7개 파일, 47개 테스트 통과.
  - `npm run build`: 통과. 500kB 초과 chunk 경고는 유지됐다.
  - `git diff --check`: 통과.

#### 3. 수동 검증

- assistant 브라우저 검증:
  - 지원자 001 이동 직후 target form의 select/button disabled, `aria-busy="true"`, “단계를 저장하는 중입니다.” 문구를 확인했다.
  - 성공 뒤 새로고침 후 지원자 001이 목표 컬럼에 남아 localStorage mock 저장소와 화면이 일치함을 확인했다.
- 사용자 보고:
  - 강제 PATCH 실패 뒤 “단계 이동을 저장하지 못했습니다.” 알림과 최종 원래 컬럼 복귀를 확인했다. 즉시 목표 컬럼으로 이동했다가 복원되는 중간 프레임은 육안으로 분리하지 못했다.
  - A 실패/B 성공, 동일 카드 요청 1회, 서로 다른 두 카드의 독립 이동, pending UI, 실패 알림, 성공 영속성을 확인했다고 보고했다.

#### 4. 최종 판단

- 수정 후 채택 제안.
- 자동화로 확인한 범위: 낙관적 성공·실패 rollback, 결정적 A/B interleaving, 동일 ID guard, 단건 cache 병합, lint/test/build.
- 남은 위험: 브라우저에서 강제 실패 시 낙관적 이동과 rollback 사이의 중간 프레임은 사용자 육안으로 분리 검증되지 않았으며, 제어된 통합 테스트로 보완했다.

### 연결 커밋

- 메시지:

  ```text
  feat(optimistic-update): 즉시 단계 반영과 엔티티 단위 실패 롤백

  - Query cache에서 대상 지원자만 낙관적으로 변경
  - 실패 시 이전 지원자 엔티티만 복원해 동시 이동 결과 보호
  - synchronous pending guard로 동일 카드의 중복 이동 차단
  ```

- 해시: `153c66b`
- AI 초안 수정 요약: 응답 순서를 제어하는 통합 테스트로 낙관적 상태와 엔티티 rollback 경계를 실제로 검증했다.

## 기능 기록 템플릿

아래 블록을 기능마다 복사한다. 제출 전 빈 템플릿은 제거한다.

````md
## [search-filter] 이름 검색과 데이터 기반 직무 필터

### 목표 / 수용 기준

- 연결 요구사항: FR-05
- 이번 기능에서 완료할 범위:
  - 이름 부분 검색, 공백 무시, 영문 대소문자 무시
  - 현재 지원자 목록 기반 직무 옵션과 전체 옵션
  - 이름·직무 AND 필터, 초기화, 필터 결과 기준 컬럼 카드·카운트 갱신
  - 필터·직무 옵션·단계 그룹화 순수 함수 테스트
- 이번 기능에서 하지 않을 범위:
  - 서버 검색·페이지네이션·검색 인덱스
  - `useDeferredValue`, 가상화 등 측정 전 최적화
  - 상세 패널, 조회 오류·빈 상태, Undo, 전역 상태 라이브러리, 커밋

### 프롬프트 1 — 최초 지시

```text
`card-list`와 `optimistic-update` 개발진행 완료 및 안정된 것을 확인하고

AGENTS.md와 docs/PRD.md, docs/TECH\_SPEC.md,
docs/IMPLEMENTATION\_AND\_COMMIT\_PLAN.md, DECISIONS.md, PROMPTS.md 및 현재 코드를 읽어라.

이번 작업 scope는 search-filter 하나뿐이다.
연결 요구사항은 FR-05다.

완료 기준:

- 이름 일부 문자열로 지원자를 검색할 수 있다.
- 검색어 앞뒤 공백은 무시한다.
- 영문 이름 검색은 대소문자를 구분하지 않는다.
- 현재 지원자 데이터에 존재하는 직무만 필터 옵션으로 제공한다.
- 전체 직무 옵션을 제공한다.
- 이름 검색과 직무 필터는 AND 조건으로 동작한다.
- 필터 결과에 따라 각 컬럼 카드와 카운트가 함께 갱신된다.
- 필터 초기화 액션이 있다.
- 필터 변경은 mock API나 localStorage 데이터를 바꾸지 않는다.
- 필터와 단계별 그룹화는 순수 함수로 분리하고 테스트한다.
- 기본 240건에서 입력이 끊기지 않도록 단순한 클라이언트 계산을 사용한다.

이번 작업에서 하지 않을 것:

- 서버 검색·페이지네이션·검색 인덱스
- useDeferredValue, 가상화 등 측정 전 성능 최적화
- 상세 패널과 조회 오류·빈 상태 전반
- Undo, 새 전역 상태 라이브러리, 범위 밖 리팩터링
- 커밋

제약:

- 지원자 원본 목록은 TanStack Query cache만 사용한다.
- 검색어와 직무 선택값은 RecruitmentBoard 수준의 로컬 UI state로 둔다.
- 필터링과 그룹화는 React 컴포넌트 밖 순수 함수로 둔다.
- STAGES와 ApplicantRole 등 기존 도메인 모델을 재사용한다.
- 직무 옵션은 현재 조회된 원본 목록에서 중복 없이 생성한다.
- 검색 조건은 nameQuery.trim().toLowerCase()와 동일한 이름 정규화 규칙을 사용한다.
- 기존 카드, 컬럼, 이동 기능을 중복 구현하지 않는다.
- 관련 없는 파일은 수정하지 않는다.

편집 전에 다음을 출력해라.

1. 재사용할 현재 query·board·column·도메인 코드
2. 수정·생성할 파일과 책임
3. 검색어와 직무 필터가 결과·컬럼 카운트로 이어지는 데이터 흐름
4. 공백, 대소문자, AND 조건, 초기화, 데이터 불변성의 경계 시나리오
5. 먼저 실패를 확인할 순수 함수 테스트 계획
6. 범위를 넘는 제안과 제외 이유

그 뒤 search-filter 범위만 최소 구현해라.
구현 후 변경 파일, diff 요약, 실제 실행한 명령과 결과, 수동 검증 항목,
알려진 한계를 보고하고 멈춰라. 커밋하지 마라.
```

### AI 출력 요지

- Query cache의 지원자 목록에서 이름·직무를 순수하게 필터링하고, 필터 결과를 기존 단계 그룹화에 전달했다.
- 현재 조회 데이터에서 중복 없는 직무 옵션을 생성하고, 검색어·직무 선택값은 보드의 로컬 state로만 유지했다.
- 기존 카드·컬럼·단계 이동을 재사용해 필터 결과에 따라 카드와 카운트가 함께 바뀌도록 했다.

### 리뷰 / 검증

#### 1. 코드 정독

- 유지: 지원자 원본은 TanStack Query cache만 사용하고, mock API와 `localStorage` 접근을 추가하지 않았다.
- 수정: 이름 정규화는 검색어와 지원자 이름 모두 `trim().toLowerCase()`로 처리했고, 직무는 `Set`으로 중복 제거했다.
- 기각: 서버 검색, 별도 전역 상태, 검색 인덱스, `useDeferredValue`, 가상화. 기본 240건에는 직접 필터·그룹화로 충분하다.

#### 2. 자동 검증

- RED 확인:
  - `filterApplicants` 부재 상태에서 공백·영문 대소문자 검색 테스트가 `undefined` 결과로 실패했다.
  - `getApplicantRoles` 부재 상태에서 데이터 기반 직무 옵션 테스트가 `undefined` 결과로 실패했다.
  - 툴바 부재 상태에서 통합 테스트가 `이름 검색` label을 찾지 못해 실패했다.
- 실행 명령:
  - `npm run test -- src/features/recruitment-board/model/applicantSelectors.test.ts`
  - `npm run test -- src/App.test.tsx`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `git diff --check`
- 실제 결과:
  - 순수 함수 테스트 3개 통과.
  - 앱 테스트 11개 통과.
  - 전체 Vitest 7개 파일, 50개 테스트 통과.
  - lint와 build 통과, `git diff --check` 통과.
  - build는 기존 500kB chunk 경고를 출력했다.

#### 3. 수동 검증

- 사용자 확인: 이름 부분 검색, 검색어 앞뒤 공백 무시, 직무 단독 필터, 이름·직무 AND 필터, 컬럼별 결과 수 갱신, 필터 초기화, 새로고침 뒤 저장된 단계 불변을 확인했다.
- 사용자 확인: 기본 240건에서 이름 입력 체감 성능, 검색 input·직무 select·초기화 button의 키보드 조작, 탭 순서와 시각적 포커스 표시에 문제 없음을 확인했다.
- 미검증: 현재 mock 성명에 영문 이름이 없어 영문 대소문자 무시 조건은 브라우저에서 수동 확인하지 못했다. 해당 조건은 자동 테스트 fixture로 검증했다.

#### 4. 최종 판단

- 수정 후 채택.
- 내가 최종 책임지고 확인한 범위: 부분 검색, 공백·영문 대소문자 정규화, 역할 AND 조건, 현재 데이터 기반 역할 중복 제거, 필터 결과의 컬럼 카드·카운트 갱신, 초기화, 순수 함수 입력 불변성.
- 미검증 또는 남은 위험: 영문 성명이 없는 현재 mock 데이터에서는 영문 대소문자 수동 검증을 할 수 없다. Must 기능이 모두 안정된 뒤 `mock-data-diversity` 독립 scope에서 영문 성명을 seed에 추가해 시연 범위를 보완한다.

### 후속 프롬프트 2 — 수정 또는 리뷰 요청

```text
승인
```

### 후속 출력과 추가 검증

- 변경 내용: 제시한 최소 설계에 따라 순수 선택 함수와 보드 로컬 필터 state를 구현했다.
- 추가로 발견한 문제: 초기 영문 검색 fixture가 한글 이름 목록과 맞지 않아 영어 이름 fixture로 보정했다.
- 최종 반영 내용: 영문 이름 기준 대소문자·공백 정규화와 UI 필터 결과 검증을 유지했다.

### 후속 프롬프트 3 — 리뷰 지적 보완

```text
최소 수정안으로 회귀 방어 보완하라.
```

### 후속 출력과 추가 검증

- 변경 내용: `filterApplicants`에 전달한 `source` 배열의 호출 전 snapshot을 보존해, 결과뿐 아니라 실제 입력 배열이 변경되지 않음을 검증했다.
- 사용자 수동 검증 반영: 240건 입력 체감 성능과 키보드 탭 순서·시각적 포커스 표시에 문제가 없다고 확인했다.
- 실행: `npm run test -- src/features/recruitment-board/model/applicantSelectors.test.ts`, `npm run lint`, `npm run test`, `npm run build`, `git diff --check`.
- 결과: 순수 함수 테스트 3개 및 전체 50개 테스트, lint, build, diff 검사 통과. build의 기존 500kB chunk 경고는 유지됐다.

### 연결 커밋

- 메시지:

  ```text
  feat(search-filter): 이름 검색과 데이터 기반 직무 필터 구현

  - Query cache 원본 목록을 이름·직무 조건으로 순수 필터링
  - 현재 데이터 기반 직무 옵션과 필터 초기화 UI 추가
  - 서버 저장 상태를 변경하지 않는 로컬 UI 필터로 유지
  ```

- 해시: `bb3ab4b`
- AI 초안 수정 요약: 미검증 브라우저 성능 최적화 대신 240건 직접 계산과 자동 검증 범위만 유지했다.

## [detail-panel] 지원자 상세 다이얼로그 구현

### 목표 / 수용 기준

- 연결 요구사항: FR-06
- 이번 기능에서 완료할 범위:
  - 카드 본문의 상세 열기 button과 우측 sheet 스타일 native `<dialog>`
  - 지원자 상세 필드, 접근 가능한 제목·닫기 button, `showModal()` 호출
  - `close` 이벤트 기반 상태 동기화, trigger focus와 보드 스크롤 복귀
  - 상세 열기·닫기 자동 테스트
- 이번 기능에서 하지 않을 범위:
  - 상세 패널 내부 단계 이동, 모달·focus trap 라이브러리
  - 검색·필터·낙관적 업데이트·조회 상태 UI 변경, 반응형 재설계, 커밋

### 프롬프트 1 — 최초 지시

```text
AGENTS.md와 docs/PRD.md, docs/TECH\_SPEC.md,
docs/IMPLEMENTATION\_AND\_COMMIT\_PLAN.md, DECISIONS.md, PROMPTS.md 및 현재 코드를 읽어라.

이번 작업 scope는 detail-panel 하나뿐이다.
연결 요구사항은 FR-06이다.

완료 기준:
\- 카드 본문의 상세 열기 컨트롤을 클릭하거나 키보드로 실행하면 우측 패널 형태의 모달이 열린다.
\- 네이티브 \<dialog>와 showModal()을 사용한다.
\- 상세 패널에는 이름, 직무, 지원일, 현재 단계, 이메일, 전화번호,
&#x20; 경력 연차, 주요 기술, 메모가 표시된다.
\- 패널에는 접근 가능한 제목과 닫기 버튼이 있다.
\- Esc로 닫을 수 있다.
\- 닫은 뒤 상세를 열었던 컨트롤로 포커스가 돌아간다.
\- 패널을 열고 닫아도 검색어, 직무 필터, 보드 스크롤 맥락이 유지된다.
\- 상세 열기 컨트롤과 단계 이동 form의 interactive 요소가 중첩되지 않는다.
\- 상세 열기·닫기 키보드 동작을 테스트한다.

이번 작업에서 하지 않을 것:
\- 상세 패널 안의 단계 이동
\- 새 모달 라이브러리·focus trap 라이브러리 추가
\- 검색·필터, 낙관적 업데이트, 조회 상태 UI 변경
\- 모바일 전용 반응형 재설계, 범위 밖 리팩터링
\- 커밋

제약:
\- 선택된 지원자 ID와 패널 열림 상태는 RecruitmentBoard 수준의 로컬 UI state로 관리한다.
\- 지원자 원본 목록은 TanStack Query cache를 재사용한다.
\- \<dialog>는 aria-labelledby로 제목과 연결한다.
\- 브라우저 기본 Esc 닫힘과 React 상태가 불일치하지 않게 close 이벤트를 처리한다.
\- 기존 카드의 stage 이동 form과 상세 열기 button을 구조적으로 분리한다.
\- 관련 없는 파일은 수정하지 않는다.

편집 전에 다음을 출력해라.
1\. 재사용할 카드·보드·지원자 모델 코드
2\. 수정·생성할 파일과 책임
3\. 상세 열기, dialog showModal, 닫기, focus restore의 상태 흐름
4\. Esc, 닫기 button, 키보드 실행, 중첩 interactive 요소, 맥락 보존의 경계 시나리오
5\. 먼저 실패를 확인할 테스트 계획
6\. 범위를 넘는 제안과 제외 이유

그 뒤 detail-panel 범위만 최소 구현해라.
구현 후 변경 파일, diff 요약, 실제 실행한 명령과 결과, 수동 검증 항목,
알려진 한계를 보고하고 멈춰라. 커밋하지 마라.
```

### AI 출력 요지

- Query cache의 지원자 원본에서 선택 ID를 찾고, 보드 로컬 state와 ref로 native `<dialog>` 열기·닫기·focus 복귀를 처리했다.
- 상세 button과 단계 이동 form을 형제 요소로 두고, dialog를 `aria-labelledby` 제목·닫기 button·모든 FR-06 상세 필드로 구성했다.
- 실제 브라우저에서 발견한 focus 복귀 시 보드 가로 스크롤 이동을 열기 전 위치 복원으로 보완했다.

### 리뷰 / 검증

#### 1. 코드 정독

- 유지: 지원자 원본은 TanStack Query cache만 사용했고, 검색어·직무 필터·이동 mutation에는 변경을 추가하지 않았다.
- 수정: `close` 이벤트 하나가 닫기 button과 브라우저 기본 Esc 닫힘을 모두 state 해제·trigger focus 복귀로 연결한다. 이미 열린 dialog에는 `showModal()`을 다시 호출하지 않는다.
- 기각: 별도 모달/focus trap 라이브러리, 패널 내부 단계 이동, 새 전역 상태와 반응형 재설계. native dialog와 보드 로컬 state로 현재 기준을 충족한다.

#### 2. 자동 검증

- RED 확인:
  - 상세 button 부재 상태에서 `김민지 상세 열기` button을 찾지 못해 실패했다.
  - 보드 scrollLeft 복원 로직 부재 상태에서 `30`이 `120`이어야 한다는 테스트가 실패했다.
- 실행 명령:
  - `npm run test -- src/App.test.tsx`
  - `git diff --check`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- 실제 결과:
  - 앱 테스트 14개 통과.
  - 전체 Vitest 7개 파일, 53개 테스트 통과.
  - lint, build, diff whitespace 검사 통과.
  - build는 기존 500kB chunk 경고를 출력했다.

#### 3. 수동 검증

- 로컬 Vite 앱에서 `지원자 006 상세 열기`를 클릭해 우측 dialog의 제목, 직무, 지원일, 단계, 이메일, 전화번호, 경력, 기술, 메모를 확인했다.
- 닫기 button 뒤 focus가 상세 trigger로 복귀하고, 적용한 `지원자 006` 검색어가 유지되는 것을 확인했다.
- 실제 브라우저에서 focus 복귀가 보드 가로 스크롤을 바꾸는 문제를 `112 → 30`으로 재현했다. 자동 테스트로 열기 전 scrollLeft 복원을 보호했다.
- 사용자 확인: 실제 브라우저에서 Enter/Space 상세 열기, Esc 닫기, 직무 필터 보존, 작은 viewport의 panel overflow를 검증했다.

#### 4. 최종 판단

- 수정 후 채택.
- 내가 최종 책임지고 확인한 범위: native dialog 열기, 상세 필드, 접근 가능한 제목, 닫기 button, close 이벤트 상태 동기화, focus 복귀, 필터와 보드 스크롤 위치 복원, 상세 button/form 구조 분리.
- 미검증 또는 남은 위험: browser-level 키보드 입력 자동화는 현재 Vitest/jsdom 범위에 없다. 실제 브라우저 동작은 사용자 확인으로 기록했다.

### 후속 프롬프트 2 — 미커밋 diff 리뷰

```text
현재 브랜치의 미커밋 diff를 리뷰해라. 파일은 수정하지 마라.

대상 scope는 detail-panel이고 연결 요구사항은 FR-06이다.

우선순위:
1\. 카드 상세 컨트롤이 클릭과 키보드 실행 모두로 dialog를 여는가
2\. \<dialog>와 showModal()을 사용하며 제목이 aria-labelledby로 연결되는가
3\. 요구된 모든 상세 필드가 올바른 지원자 데이터로 표시되는가
4\. 닫기 button과 Esc가 모두 동작하는가
5\. dialog의 close 이벤트와 React 상태가 일치하는가
6\. 닫은 뒤 trigger로 포커스가 복귀하는가
7\. 검색어, 직무 필터, 보드 스크롤이 열기·닫기 과정에서 바뀌지 않는가
8\. 상세 열기 button과 stage 이동 select/button/form이 중첩되지 않는가
9\. 불필요한 모달 의존성, 전역 상태, 범위 밖 변경이 없는가
10\. 테스트가 통과해도 놓칠 접근성 반례가 있는가

각 지적은 아래 형식으로 작성해라.
\- 심각도: blocker / major / minor
\- 파일과 코드 위치
\- 재현 시나리오
\- 왜 문제인지
\- 최소 수정안

문제가 없으면, 확인한 범위와 아직 검증하지 못한 범위를 분리해라.
```

### 후속 프롬프트 3 — 리뷰 지적 보완

```text
실제 브라우저의 Enter/Space·Esc 동작, 직무 필터 보존 자동 회귀, 작은 viewport에서 panel 외형의 overflow => 모두 실제 브라우저에서 검증 완료했고

방금 detail-panel 리뷰에서 확인된 major,minor만 수정해라.

이번 작업은 FR-06 범위를 벗어나지 않는다.
상세 패널 내부 단계 이동, 모달 라이브러리, 검색·필터 변경, 조회 상태 UI,
전역 상태 추가는 구현하지 마라.

수정 전에 각 지적의 원인과 최소 수정 파일을 짧게 제시해라.
수정 후 아래 검증을 실제로 실행하고 결과를 보고해라.

- 카드 상세 button 클릭으로 dialog 열기 테스트
- Enter 또는 Space 키보드 실행 테스트
- 모든 상세 필드 표시 테스트
- Esc 닫기 테스트
- 닫기 button 테스트
- 닫은 뒤 trigger focus 복귀 테스트
- npm run lint
- npm run test
- npm run build

변경 파일, 수정한 지적, 실제 명령 결과, 남은 미검증 사항을 보고한 뒤 멈춰라.
커밋하지 마라.
```

### 후속 출력과 추가 검증

- 수정: 검색어·직무 필터를 설정한 뒤 dialog를 열고 닫아도 두 값이 보존되는 자동 회귀 테스트를 추가했다.
- 수정: dialog에 `box-sizing: border-box`를 추가해 `100dvh`와 padding이 합쳐져 viewport를 넘지 않게 했다.
- 실행: `npm run test -- src/App.test.tsx`, `git diff --check`, `npm run lint`, `npm run test`, `npm run build`.
- 결과: 앱 테스트 15개, 전체 54개 테스트, lint, build, diff 검사가 통과했다. build의 기존 500kB chunk 경고는 유지됐다.

### 후속 프롬프트 4 — 패널 하단·배경 보드 스크롤 분석

```text
모두 정상작동 하나, 패널이 열린 채로 세로 스크롤 이동이 가능하며, 패널 하단 공백이 보여서 하얀색 배경으로 세로가 꽉 차지 않는다. 코드 분석 및 최소 수정안 알려줘
```

### 후속 프롬프트 5 — full-height sheet와 배경 스크롤 보완 확인

```text
상세 패널을 열면 배경 보드가 세로 스크롤되고 패널 하단이 viewport를 채우지 않는 문제를 확인하여
CSS Module 환경에서 body 스크롤 잠금 selector가 dialog의 hashed 클래스와 매칭되도록 :global(body):has(.detailDialog[open]) 형태로 보정
dialog를 우측 full-height sheet로 고정하기 위해 position: fixed, inset: 0 0 0 auto, height: 100dvh, max-height: none, background: #fff, overflow-y: auto를 적용
이 변경 과정에서 기존 border: 0이 빠져 native \<dialog>의 기본 3px border가 다시 보이는 것을 확인하여 border: 0을 다시 추가함
검증내용 확인 및 업데이트
```

### 후속 출력과 추가 검증

- 사용자 수정 확인: `:global(body):has(.detailDialog[open])`은 전역 body와 CSS Module의 해시된 `.detailDialog`를 함께 선택한다. dialog가 열린 동안 배경 보드의 세로 스크롤을 잠근다.
- 사용자 수정 확인: dialog에는 `position: fixed`, `inset: 0 0 0 auto`, `height: 100dvh`, `max-height: none`, 흰 배경, 내부 세로 스크롤, `border: 0`이 적용돼 우측 full-height sheet와 native border 제거를 처리한다.
- 자동 검증: `npm run lint`, `npm run test`, `npm run build`, `git diff --check`를 실행했다. lint와 diff 검사 통과, Vitest 7개 파일·54개 테스트 통과, production build 통과. build의 기존 500kB chunk 경고는 유지됐다.
- 수정: 우측 sheet의 `width`, `padding`, `box-shadow`를 복구했고 full-height·배경 스크롤 잠금·native border 제거 보정은 유지했다.

### 후속 프롬프트 6 — sheet 폭·여백·그림자 복구

```text
이전의 `width`, `padding`, `box-shadow` 복구
```

### 후속 출력과 추가 검증

- 수정: `.detailDialog`에 `width: min(30rem, 100%)`, `padding: 1.5rem`, `box-shadow: -0.5rem 0 1.5rem rgb(23 32 51 / 20%)`를 복구했다.
- 실행: `git diff --check`, `npm run lint`, `npm run test`, `npm run build`.
- 결과: lint와 diff 검사 통과, Vitest 7개 파일·54개 테스트 통과, production build 통과. build의 기존 500kB chunk 경고는 유지됐다.

### 연결 커밋

- 메시지:

  ```text
  feat(detail-panel): 지원자 상세 다이얼로그 제공

  - native dialog와 보드 로컬 선택 state로 상세 패널 추가
  - close 이벤트에서 trigger focus와 보드 스크롤 맥락 복원
  - 상세 필드와 닫기 동작 회귀 테스트 추가
  ```

- 해시: `969f517`
- AI 초안 수정 요약: focus 복귀만으로 충분하다는 초안을 기각하고, 실제 브라우저에서 재현한 가로 스크롤 변경까지 복원했다.

## [ui-states] 로딩·조회 오류·전체 및 필터 빈 상태

### 목표 / 수용 기준

- 연결 요구사항: FR-07
- 초기 로딩, 조회 오류, 전체 빈 상태, 검색 결과 빈 상태와 컬럼 빈 상태를 구분한다.
- 조회 오류는 기술 오류를 노출하지 않고 `role="alert"` 및 `refetch()` 재시도를 제공한다.
- 검색 결과 빈 상태의 초기화는 기존 필터 초기화 동작을 재사용한다.

### 프롬프트 1 — 최초 지시

AGENTS.md와 docs/PRD.md, docs/TECH\_SPEC.md,
docs/IMPLEMENTATION\_AND\_COMMIT\_PLAN.md, DECISIONS.md, PROMPTS.md 및 현재 코드를 읽어라.

이번 작업 scope는 ui-states 하나뿐이다.
연결 요구사항은 FR-07이다.

완료 기준:

- 초기 조회 중에는 보드 영역과 유사한 최소 로딩 UI가 보인다.
- 로딩 UI에는 aria-busy="true"와
  "지원자 정보를 불러오는 중입니다." 문구가 있다.
- 조회 실패 시 기술 오류를 그대로 노출하지 않는 오류 설명과 다시 시도 button을 제공한다.
- 조회 오류는 role="alert"로 전달한다.
- 원본 지원자 목록이 0건이면 전체 빈 상태를 표시한다.
- 원본은 있지만 검색·필터 결과가 0건이면 별도의 검색 결과 빈 상태를 표시한다.
- 검색 결과 빈 상태에는 필터 초기화 button이 있다.
- 전체 빈 상태와 검색 결과 빈 상태의 문구가 다르다.
- 필터 결과 전체가 0건이 아니고 특정 stage만 비어 있으면 해당 컬럼에 짧은 빈 상태를 표시한다.
- retry 성공 후 정상 보드가 다시 보인다.
- 각 상태를 결정적으로 테스트한다.

이번 작업에서 하지 않을 것:

- 별도 skeleton 컴포넌트·애니메이션·toast 라이브러리
- API 계약, mock DB, 검색·필터 로직, 상세 패널 변경
- 새로운 전역 상태, 범위 밖 리팩터링
- 커밋

제약:

- 기존 useApplicantsQuery의 isPending, isError, data, refetch를 재사용한다.
- 상태 분기 순서는 isPending → isError → 원본 목록 0건 →
  필터 결과 0건 → 보드로 유지한다.
- retry는 refetch()만 호출한다.
- 로딩, 조회 오류, 전체 빈 상태, 검색 결과 빈 상태를 하나의 모호한 문구로 합치지 않는다.
- 검색 결과 빈 상태의 초기화는 기존 필터 초기화 함수를 재사용한다.
- 관련 없는 파일은 수정하지 않는다.

편집 전에 다음을 출력해라.

1. 재사용할 query 상태, 필터 상태, board·column 코드
2. 수정·생성할 파일과 책임
3. 다섯 상태 분기의 우선순위와 데이터 흐름
4. GET 실패, retry 성공, 원본 0건, 필터 결과 0건, 컬럼만 0건의 검증 시나리오
5. 먼저 실패를 확인할 테스트 계획
6. 범위를 넘는 제안과 제외 이유

그 뒤 ui-states 범위만 최소 구현해라.
구현 후 변경 파일, diff 요약, 실제 실행한 명령과 결과, 수동 검증 항목,
알려진 한계를 보고하고 멈춰라. 커밋하지 마라.

### AI 출력 요지

- `useApplicantsQuery`의 `isPending`, `isError`, `data`, `refetch`로 정해진 다섯 상태 분기를 `App`에 추가했다.
- 기존 툴바 초기화 로직을 `resetFilters`로 이름 붙여 검색 결과 빈 상태 버튼에도 재사용했다.
- 정상 보드에서만 stage별 결과가 0건일 때 짧은 빈 문구를 표시했다.
- MSW 응답을 이용해 로딩, 오류·재시도, 두 빈 상태, 컬럼 빈 상태를 결정적으로 테스트했다.

### 리뷰 / 검증

#### 1. 코드 정독

- 유지: Query cache와 기존 필터 selector를 그대로 사용하고 API·mock·상세 패널에는 손대지 않았다.
- 수정: 기존 보드 전제 테스트는 초기 로딩 UI가 먼저 보이는 새 흐름에 맞춰 정상 보드를 기다리도록 보정했다.
- 기각: 별도 skeleton 컴포넌트·애니메이션·toast·전역 상태는 FR-07에 필요하지 않아 추가하지 않았다.

#### 2. 자동 검증

- RED: `npm run test -- src/App.test.tsx` 실행 결과, 새 UI 상태 테스트 5개가 기능 부재로 실패했다.
- GREEN: 같은 명령 실행 결과, `src/App.test.tsx` 20개 테스트가 통과했다.
- 실행: `git diff --check`, `npm run lint`, `npm run test`, `npm run build`.
- 실제 결과: diff whitespace 오류 없음, lint 통과, Vitest 7개 파일·59개 테스트 통과, production build 통과.
- build 경고: 기존 500kB 초과 chunk 경고가 유지되며 이번 scope에서는 변경하지 않았다.

#### 3. 수동 검증

- 사용자 완료 보고:
  - 초기 로딩 문구와 `aria-busy` 표시
  - GET 실패 오류 설명과 다시 시도
  - 재시도 성공 뒤 정상 보드 복귀
  - 원본 0건 전체 빈 상태
  - 검색·직무 조건 0건 검색 결과 빈 상태와 필터 초기화
  - 특정 stage의 컬럼 빈 상태
  - 오류·전체 빈·검색 결과 빈 문구 구분
  - retry와 필터 초기화의 키보드 실행

#### 4. 최종 판단

- 수정 후 채택: FR-07의 로딩, 조회 오류·재시도, 전체/검색 결과 빈 상태, 컬럼 빈 상태를 자동 테스트로 확인했다.
- 남은 위험: build의 기존 500kB 초과 chunk 경고는 이번 scope에서 변경하지 않았다.

### 연결 커밋

- 메시지:

  ```text
  feat(ui-states): 로딩·조회 오류·빈 상태 처리

  - query 상태 우선순위에 따라 로딩과 조회 오류를 구분
  - 전체 데이터 없음과 필터 결과 없음을 별도 UI로 제공
  - retry와 필터 초기화로 정상 보드 복귀 지원
  ```

- 해시: `9caa7da`
- AI 초안 수정 요약: 초기 상태에서도 빈 보드를 렌더링하던 기존 흐름을 상태 우선순위 분기로 교체했다.

## [fix(a11y-live-status)] 단계 이동 라이브 상태 메시지

### 목표 / 수용 기준

- 연결 요구사항: FR-04, FR-11
- 진행·성공 메시지를 polite live region으로, 실패 메시지를 rollback 사실을 포함한 alert로 전달한다.
- A 실패 뒤 B 성공에도 실패 alert와 성공 status가 각각 유지된다.
- 기존 Query cache 기반 낙관적 업데이트·엔티티 단위 rollback·동일 ID synchronous pending guard를 변경하지 않는다.

### 프롬프트 1 — 최초 지시

```text
이번 작업 scope는 fix(a11y-live-status) 하나뿐이다.
연결 요구사항은 FR-04와 FR-11이다.

현재 문제:

- 진행 중 문구가 일반 p여서 라이브 리전이 아니다.
- 성공 메시지가 없다.
- 지원자 A의 이동 실패 후 지원자 B가 성공하면, B의 onSuccess가 A의 실패 alert를 지운다.

완료 기준:

- 이동 진행 문구가 role="status" 또는 동등한 polite live region으로 전달된다.
- 성공한 이동은 지원자 이름과 목표 단계가 포함된 성공 메시지로 전달된다.
- 실패 메시지는 role="alert"이며 “이전 상태로 복원” 사실을 포함한다.
- A 실패 뒤 B 성공에도 A의 실패 alert는 유지된다.
- 성공 메시지와 실패 메시지는 별도 상태로 관리한다.
- 기존 낙관적 업데이트, 단건 rollback, 동일 ID synchronous guard, 다른 ID 병렬 이동을 바꾸지 않는다.
- 새 라이브러리, toast 시스템, 전역 상태, 자동 소멸 타이머는 추가하지 않는다.
- 관련 테스트와 PROMPTS.md의 현재 scope 기록을 같은 diff에 포함한다.
- 커밋하지 않는다.
```

### 프롬프트 2 — 미커밋 diff 리뷰와 보완

```text
현재 브랜치의 미커밋 diff를 리뷰해라. 파일은 수정하지 마라.

대상 scope는 fix(a11y-live-status)이고 연결 요구사항은 FR-04, FR-11이다.

우선순위:

1. 진행·성공 메시지가 role="status" 또는 aria-live="polite"로 전달되는가
2. 실패 메시지가 role="alert"이며 rollback 사실을 알리는가
3. A 실패 후 B 성공이 A의 실패 alert를 지우지 않는가
4. 성공·실패 상태가 서로 다른 이동 요청에서도 독립적인가
5. 기존 entity 단위 rollback과 동일 ID synchronous guard가 유지되는가
6. 중첩 interactive 요소, 이름 없는 컨트롤, 색상만 의존한 pending 표시가 없는가
7. toast 라이브러리·전역 상태·타이머 같은 불필요한 확장이 없는가
8. 테스트가 통과해도 놓치는 경쟁 상태 반례가 있는가

방금 fix(a11y-live-status) 리뷰에서 확인된 minor를 최소 수정해라.
```

### AI 출력 요지

- 이동 mutation의 cache·rollback·pending guard는 유지하고, 성공·실패 결과를 App의 별도 로컬 state로 전달했다.
- pending과 success는 `role="status"`, 실패는 `role="alert"`로 렌더링했다. 실패 문구에는 이전 상태 복원 사실을 명시했다.
- A 실패 뒤 B 성공 시 alert 유지와 B의 success status가 동시에 보이는 회귀 assertion을 추가했다.

### 리뷰 / 검증

#### 1. 코드 정독·리뷰

- 원인: 기존 `useMoveApplicantStage`의 단일 `moveError`를 `onSuccess`가 비워, 다른 지원자의 성공이 실패 alert를 지웠다.
- 수정: error state와 success state를 App에서 분리했다. 성공 콜백은 error state를 건드리지 않는다.
- 유지: `previousApplicant` 한 건만 `replaceApplicant`로 복원하고, `pendingIdsRef`의 동기 guard와 카드별 `aria-busy`·disabled를 보존했다.
- 리뷰 보완: A 실패·B 성공 테스트가 alert만 확인하던 빈틈을 발견해 B의 `role="status"`도 확인하도록 보강했다.
- 기각: toast 라이브러리, 전역 상태, 자동 소멸 타이머, rollback/guard 재설계는 요구사항에 필요하지 않아 추가하지 않았다.

#### 2. 자동 검증

- RED: `npm run test -- src/App.test.tsx`에서 success status 부재, pending의 status 부재, rollback 문구 부재, A 실패 alert 유지 미검증 조건으로 4개 테스트 실패를 확인했다.
- focused 실행:
  - A 실패 → B 성공 후 alert와 success status: 통과
  - 성공 status: 통과
  - pending live region: 통과
  - 동일 ID 중복 차단: 통과
- 전체 실행:
  - `git diff --check`: 통과
  - `npm run lint`: 통과
  - `npm run test`: Vitest 7개 파일, 59개 테스트 통과
  - `npm run build`: 통과. 기존 500kB 초과 chunk 경고는 유지됐다.

#### 3. 수동 검증

- 사용자 완료 검증: `docs/LOCAL_BROWSER_TESTING.md` 절차로 다음을 실제 브라우저에서 확인했다.
  - 키보드 상세 열기·닫기와 키보드 단계 이동
  - pending status, select/button disabled, form의 `aria-busy="true"`
  - 강제 성공 status와 강제 실패 rollback alert·카드 위치 복원
  - A 실패 뒤 B 성공에도 A alert 유지
  - 같은 카드 빠른 두 번 실행 차단과 서로 다른 카드 동시 이동
- VoiceOver를 켠 상태에서 pending status가 안내되는 것도 확인했다.

#### 4. 최종 판단

- 수정 후 채택: 진행·성공·실패 메시지의 라이브 리전 역할, rollback 안내, A 실패/B 성공 동시 메시지 보존을 자동 테스트로 확인했다.
- 남은 위험: 동시 pending 카드가 여러 개이면 여러 status region이 생성된다. 이번 scope는 카드별 병렬 이동 허용 계약을 유지한다.

### 연결 커밋

- 예정 메시지:

  ```text
  fix(a11y-live-status): 이동 상태 알림 접근성 보완

  - 진행·성공·실패 상태를 라이브 리전으로 전달
  - 성공 요청이 다른 카드의 실패 alert를 지우지 않도록 상태 분리
  - A 실패/B 성공 경쟁 상태 회귀 테스트 추가
  ```

- 해시: 최종 동기화 대기

## [submission-review] 제출 전 프롬프트 기록 정합성 검토

### 목표 / 수용 기준

- 연결 근거: 과제 §5~7, PRD §3.2, 구현·커밋 계획 Commit 12
- 이전 feature section의 `최종 동기화 대기` 해시를 실제 단일 커밋과 동기화한다.
- 제출용 빈 기능 템플릿을 제거한다.
- 구현 코드·과거 feature의 검증 주장·README·DECISIONS는 변경하지 않는다.

### 프롬프트 1 — 제출 전 요청

```text
프롬프트 문서 정합성 작업 후 커밋,푸시
```

### AI 출력 요지

- `PROMPTS.md`의 pending record 다섯 개를 조사하고, 각 scope와 예정 subject가 모두 일치하는 HEAD 도달 가능 커밋 하나를 확인했다.
- 확인한 실제 커밋 메시지와 short hash로 record를 치환하고 제출 전 제거 대상으로 표시된 빈 템플릿을 삭제했다.

### 리뷰 / 검증

#### 1. 문서 정독

- 채택: `prompt-record-automation`, `optimistic-update`, `search-filter`, `detail-panel`, `ui-states`의 planned subject와 scope가 각각 하나의 실제 커밋에만 대응함을 확인했다.
- 기각: 이미 커밋된 feature의 코드·검증 서술·README·DECISIONS를 이 문서 정합성 scope에서 수정하지 않았다.

#### 2. 자동 검증

- `read-prompt-log.mjs`로 이 세션의 실제 사용자 요청을 읽었다.
- `git log`와 `git show -s --format=%B`로 각 연결 커밋의 subject·본문을 확인했다.
- `git diff --check`, `npm run lint`, `npm run test`, `npm run build`를 실행했다. diff whitespace 오류 없음, lint 통과, Vitest 7개 파일·59개 테스트 통과, production build 통과를 확인했다. build의 기존 500kB 초과 chunk 경고는 유지됐다.

#### 3. 수동 검증

- 미수행: 문서·Git 메타데이터 정합성 범위라 브라우저 조작은 필요하지 않다.

#### 4. 최종 판단

- 수정 후 채택. 이전 pending hash와 빈 템플릿을 정리했으며, 이 `[submission-review]` 커밋 자신의 해시는 같은 커밋에 기록할 수 없으므로 의도적으로 동기화 대상에서 제외한다.

### 연결 커밋

- 예정 메시지:

  ```text
  docs(submission-review): 프롬프트 기록 정합성 동기화

  - 이전 feature record의 실제 커밋 메시지와 해시를 일괄 반영
  - 제출용 빈 feature 템플릿을 제거
  ```

- 해시: 최종 동기화 대기
- AI 초안 수정 요약: 코드 변경 없이 scope·subject·커밋 본문이 모두 일치하는 기록만 동기화했다.

## [prompt-record-validation-order] 사용자 검증 이후 기록·스테이징

### 목표 / 수용 기준

- 자동 검증과 unstaged diff 보고 뒤 사용자 검증을 먼저 받는다.
- 사용자 검증에서 수정이 필요하면 기록·스테이징하지 않고 구현과 자동 검증으로 돌아간다.
- 사용자 검증 결과 또는 미검증 범위의 명시적 수용 뒤에만 `prompt-record`를 실행하고 현재 scope를 stage한다.
- 이전 scope와 pending hash는 변경하지 않는다.

### 프롬프트 1 — 순서 개선 제안

```text
순서가 잘못된 거 같아. 개선까지 완료하고 스테이지된 변경사항 확인하기 전에 사용자의 검증을 받고 그 내용을 반영하여 프롬프트 업데이트가 이루어져야 하는데
오히려 블로킹 원인이 되고 있는 것 같다 지금은. 어떻게 개선하면 좋을지 제안만. 코드수정은 하지마
```

### 프롬프트 2 — 최소 변경 적용

```text
최소 지침 변경안 반영
```

### AI 출력 요지

- 자동 검증 뒤 `PROMPTS.md`를 먼저 쓰던 흐름을 사용자 검증 대기 단계와 분리했다.
- 사용자 검증에서 코드 변경이 생기면 기록하지 않고 자동 검증과 unstaged 후보 보고를 반복하도록 했다.
- 사용자 검증 또는 미검증 범위 수용 뒤에만 기록·스테이징하도록 프로젝트 지침, `prompt-record` skill, 구현·커밋 계획을 같은 순서로 맞췄다.
- 지침의 핵심 순서를 계약 테스트로 고정하고, 이미 제거된 빈 템플릿 형식에 의존하던 낡은 assertion을 제거했다.

### 리뷰 / 검증

#### 1. 지침 정독

- 원인: 기존 지침은 구현과 자동 검증 직후 completion report 전에 `prompt-record`를 실행해 사용자 검증 결과가 들어갈 자리가 없었다.
- 수정: `자동 검증 → unstaged 후보 보고 → 사용자 검증 → prompt-record → stage → 커밋 승인` 순서로 통일했다.
- 유지: 현재 scope만 기록하고 이전 scope의 pending hash는 `[submission-review]`에서만 일괄 동기화하는 계약을 보존했다.
- 기각: 별도 훅이나 새 자동화 계층은 추가하지 않았다. 기존 지침과 skill trigger 수정만으로 해결했다.

#### 2. 자동 검증

- RED: 새 순서 계약 테스트에서 기존 `before the completion report` trigger와 충돌해 실패함을 확인했다.
- focused: `node --test .agents/skills/prompt-record/prompt-record.test.mjs` — 5개 테스트 통과.
- `git diff --check`: 통과.
- `npm run lint`: 통과.
- `npm run test`: Vitest 7개 파일, 59개 테스트 통과.
- `npm run build`: 통과. 기존 500kB 초과 chunk 경고는 유지됐다.

#### 3. 수동 검증

- 미검증 범위 수용: 사용자가 unstaged 후보 보고 뒤 해당 지침 및 자동화 변경사항의 커밋·푸시를 요청했다.
- 브라우저 미수행: 애플리케이션 실행 동작을 바꾸지 않는 지침·계약 테스트 변경이다.

#### 4. 최종 판단

- 채택: 사용자 검증이 기록과 스테이징보다 앞서며, 수정 발생 시 검증 단계로 되돌아가는 순서를 문서와 테스트에 반영했다.
- 남은 제한: 사용자 검증 결과가 제공되지 않은 경우 자동으로 검증 사실을 만들지 않고 명시적 미검증 수용이 필요하다.

### 연결 커밋

- 예정 메시지:

  ```text
  chore(prompt-record-validation-order): 사용자 검증 게이트 순서 정리

  - 사용자 검증을 PROMPTS 기록과 staging 앞에 배치
  - 검증 수정 발생 시 자동 검증과 후보 보고를 반복
  - 기록 순서 계약 테스트 추가
  ```

- 해시: 최종 동기화 대기

## [docs(decision-a11y)] 단계 이동 라이브 상태 판단 기록

### 목표 / 수용 기준

- 연결 요구사항: FR-11
- native live region으로 진행·성공·실패를 처리한 판단과 A 실패 뒤 B 성공 반례를 `DECISIONS.md`에 기록한다.
- 실제 사용자 검증으로 이미 기록된 범위만 완료로 옮기고, 확인되지 않은 보조기술 동작은 미검증으로 남긴다.
- 앱 코드, 테스트, README는 수정하지 않는다.

### 프롬프트 1 — 접근성 판단 문서화

```text
AGENTS.md, docs/ASSIGNMENT.md, docs/PRD.md, docs/TECH\_SPEC.md,
docs/IMPLEMENTATION\_AND\_COMMIT\_PLAN.md, DECISIONS.md, PROMPTS.md,
README.md, 현재 코드와 최근 git log를 읽어라.

P0 fix(a11y-live-status)의 사용자 검증 결과가 기록돼 있다고 가정한다.
이번 작업 scope는 docs(decision-a11y) 하나뿐이다.

연결 요구사항은 FR-11이다.

완료 기준:

- DECISIONS.md에 이동 진행·성공·실패 상태를 native live region으로 처리한 판단을 기록한다.
- 성공과 실패 메시지를 분리한 이유를 A 실패 뒤 B 성공 반례와 연결한다.
- 새 toast 라이브러리, 전역 상태, 자동 닫힘 타이머를 기각한 이유를 기록한다.
- Undo와 1,000건 가상화의 기존 미완료 판단은 바꾸지 않는다.
- 실제 사용자 검증 범위만 완료로 기록하고, 미확인 범위는 미검증으로 남긴다.

이번 작업에서 하지 않을 것:

- 앱 코드, 테스트, README 수정
- 검증되지 않은 수동 브라우저 결과 작성
- PROMPTS.md 기록 또는 staging
- 커밋

편집 전에 다음을 출력해라.

1. 재사용할 기존 D-002, D-005, D-006, D-007 판단
2. 수정할 파일과 책임
3. FR-11과 A 실패/B 성공 반례의 연결
4. 기록하면 안 되는 검증 주장
5. 검증 계획
6. 범위 밖 제안과 제외 이유

그 뒤 DECISIONS.md만 최소 수정해라.
npm run lint, npm run test, npm run build, git diff --check를 실제 실행하고,
unstaged diff 요약·실제 결과·사용자가 확인할 문서 항목을 보고한 뒤 기다려라.
```

### AI 출력 요지

- D-002, D-005, D-006, D-007을 전제로 D-010을 추가했다.
- 진행·성공은 `role="status"`, 실패는 rollback 사실을 포함한 `role="alert"`로 기록하고, 성공·실패 상태를 분리해 A 실패 뒤 B 성공에도 A alert가 남는 이유를 설명했다.
- toast 라이브러리, 전역 상태, 자동 닫힘 타이머는 각각 새 의존성·상태 소유권·시간 상태를 더하므로 기각했다.

### 리뷰 / 검증

#### 1. 문서 정독

- 채택: D-002의 키보드 가능한 명시적 이동, D-005·D-007의 카드별 병렬 이동과 엔티티 rollback을 D-010의 근거로 재사용했다.
- 유지: D-006의 Undo와 1,000건 가상화 미완료 판단을 바꾸지 않았다.
- 기각: 앱 코드, 테스트, README, toast 라이브러리, 전역 상태, 자동 닫힘 타이머.

#### 2. 자동 검증

- `npm run lint`: 통과.
- `npm run test`: Vitest 7개 파일, 59개 테스트 통과.
- `npm run build`: 통과. 기존 500kB 초과 chunk 경고는 유지됐다.
- `git diff --check`: 통과.

#### 3. 수동 검증

- 이 문서 scope에서는 브라우저 조작을 수행하지 않았다.
- D-010의 완료 범위에는 기존 `fix(a11y-live-status)` 기록의 사용자 검증만 옮겼다. VoiceOver의 성공·실패 및 여러 카드 동시 pending 안내 순서는 미검증으로 남겼다.

#### 4. 최종 판단

- 사용자 확인: D-010의 완료·미검증 경계를 확인한 뒤 커밋·push를 요청했다.
- 채택: 실제 확인 범위를 넓히지 않고 native live region 선택과 반례를 기록했다.

### 연결 커밋

- 예정 메시지:

  ```text
  docs(decision-a11y): 라이브 상태 알림 판단 기록

  - FR-11 이동 상태를 native live region으로 처리한 이유를 기록
  - A 실패 뒤 B 성공에도 실패 안내를 보존하는 상태 분리 근거를 명시
  ```

- 해시: 최종 동기화 대기

## [stage-transition-policy] 단방향 단계 전이 정책

### 목표 / 수용 기준

- 연결 요구사항: FR-03; FR-04와 FR-08 회귀 보호
- 일반 채용담당자 UI와 mock API가 하나의 순수 전이 정책을 사용한다.
- 유효하지 않은 stage는 기존 `400 INVALID_STAGE`를 유지하고, 현재 단계에서 허용되지 않은 유효 stage는 저장 없이 `409 INVALID_TRANSITION`으로 거부한다.
- `HIRED`와 `REJECTED`는 이동 form 없이 종료 상태 문구를 표시한다.

### 프롬프트 1 — 단방향 전이 정책 구현

```text
AGENTS.md와 다음 문서를 지정된 순서로 읽어라.

1. docs/ASSIGNMENT.md
2. docs/PRD.md
3. docs/TECH\_SPEC.md
4. docs/IMPLEMENTATION\_AND\_COMMIT\_PLAN.md
5. PROMPTS.md의 현재 stage-transition-policy 섹션
6. 관련 최근 커밋과 현재 코드

이번 작업 scope는 stage-transition-policy 하나뿐이다.
연결 요구사항은 FR-03이며, FR-04와 FR-08의 기존 동작이 깨지지 않아야 한다.

변경 배경:
현재 문서와 UI는 현재 단계를 제외한 모든 단계로 이동할 수 있게 한다.
향후 단계 변경이 지원자 알림과 연결될 수 있다는 운영 가정에서는
이전 단계 복귀나 임의 단계 건너뛰기가 외부 상태와 불일치를 만들 수 있다.
따라서 일반 채용담당자 UI에서는 단방향 상태 전이만 허용한다.

확정할 전이 정책:

- DOCUMENT\_REVIEW → INTERVIEW 또는 REJECTED
- INTERVIEW → OFFER 또는 REJECTED
- OFFER → HIRED 또는 REJECTED
- HIRED → 이동 불가
- REJECTED → 이동 불가

완료 기준:

- 전이 규칙을 기존 stages 모델에 순수 데이터 또는 순수 함수로 정의한다.
- UI의 단계 선택지는 현재 단계에서 허용된 다음 단계만 표시한다.
- HIRED와 REJECTED 카드에는 이동 form을 렌더링하지 않고
  “종료된 단계입니다.”라는 상태를 표시한다.
- mock API도 같은 전이 정책을 사용한다.
- 유효한 stage지만 현재 상태에서 허용되지 않는 이동은
  409 INVALID\_TRANSITION으로 거부한다.
- 금지된 이동은 localStorage를 변경하지 않는다.
- API 직접 호출로 UI 검증을 우회해도 금지된 이동이 저장되지 않는다.
- 기존 낙관적 업데이트, 엔티티 단위 rollback, pending guard,
  서로 다른 지원자의 병렬 이동은 유지한다.
- UI와 API에 전이표를 중복해서 작성하지 않는다.
- 순수 전이 정책과 API 거부 동작을 테스트한다.

문서 반영:

- docs/PRD.md
  - “현재 단계를 제외한 모든 단계” 가정을 새 전이 정책으로 교체
  - FR-03 수용 기준 갱신
  - FR-09 Undo는 삭제하지 않고, 알림 연동 운영 위험 때문에 채택하지 않은 Should로 기록
- docs/TECH\_SPEC.md
  - 전이 정책 함수와 409 INVALID\_TRANSITION 계약 추가
  - UI와 handler가 같은 정책을 사용하도록 명시
- docs/IMPLEMENTATION\_AND\_COMMIT\_PLAN.md
  - stage-transition-policy scope와 검증 항목 추가
  - Undo 상태를 “활성 범위 제외”에서 “운영 정책상 기각”으로 명확히 변경
- DECISIONS.md
  - 단방향 전이, 종료 상태, Undo 기각 이유를 새 결정으로 기록
- README.md
  - 현재 단계 이동 규칙과 Undo 미지원 이유를 사용자 관점에서 반영
- docs/ASSIGNMENT.md는 원문이므로 수정하지 않는다.

이번 작업에서 하지 않을 것:

- 단계 변경 확인 dialog
- 실제 지원자 알림 발송
- 감사 로그나 관리자 전용 상태 정정
- seed 데이터 변경
- 리디자인과 반응형 개선
- Undo 구현
- 관련 없는 리팩터링
- 커밋
- 사용자 검증 전 PROMPTS.md 수정이나 staging

편집 전에 먼저 다음을 출력해라.

1. 요구사항 ID
2. 현재 코드에서 재사용할 부분
3. 생성·수정할 파일과 책임
4. 전이 정책 데이터 구조와 알고리즘
5. UI → mutation → mock API → localStorage 데이터 흐름
6. 유효·금지·종료 상태 검증 시나리오
7. 먼저 실패시킬 테스트
8. 범위를 넘는 제안과 제외 이유

테스트를 먼저 작성해 현재 동작에서 실패하는지 확인한 뒤 최소 구현해라.

필수 자동 검증:

- 각 활성 단계의 허용된 다음 단계 목록
- DOCUMENT\_REVIEW → OFFER 같은 단계 건너뛰기 차단
- INTERVIEW → DOCUMENT\_REVIEW 같은 이전 단계 이동 차단
- HIRED와 REJECTED에서 모든 이동 차단
- 유효하지 않은 stage는 기존 INVALID\_STAGE 유지
- 금지된 전이는 409 INVALID\_TRANSITION
- 금지된 전이 뒤 localStorage 불변
- 허용된 전이 성공과 새로고침 영속성
- 허용된 전이의 낙관적 업데이트와 실패 rollback
- 기존 동일 카드 pending guard와 다른 카드 병렬 이동
- npm run lint
- npm run test
- npm run build

자동 검증 후 unstaged diff, 변경 파일, 실제 명령 결과,
수동 검증 시나리오, 수용 기준 충족 여부와 알려진 한계를 보고하고 기다려라.
사용자 검증 결과가 오기 전에는 prompt-record, staging, commit을 진행하지 마라.
```

### 프롬프트 2 — 사용자 검증 후 읽기 전용 리뷰

```text
수동확인 시나리오 모두 확인함.

현재 브랜치의 stage-transition-policy 미커밋 diff를 읽기 전용으로 리뷰. 파일은 수정하지 마라.

연결 요구사항은 FR-03이며 FR-04, FR-08 회귀도 확인한다.

확정 전이:

- DOCUMENT\_REVIEW → INTERVIEW | REJECTED
- INTERVIEW → OFFER | REJECTED
- OFFER → HIRED | REJECTED
- HIRED → 없음
- REJECTED → 없음

우선순위:

1. UI와 mock API가 동일한 순수 전이 정책을 사용하는가
2. UI만 제한하고 직접 PATCH 요청은 허용하는 우회 경로가 없는가
3. 이전 단계 이동과 단계 건너뛰기가 모두 차단되는가
4. 모든 활성 단계에서 REJECTED 전이가 가능한가
5. HIRED와 REJECTED가 실제 종료 상태인가
6. INVALID\_STAGE와 INVALID\_TRANSITION이 정확히 구분되는가
7. 409 응답 전에 localStorage가 변경되지 않는가
8. 허용된 이동의 낙관적 업데이트·rollback·pending guard가 유지되는가
9. 문서와 실제 코드의 전이표가 일치하는가
10. Undo가 원본 과제에서 삭제되지 않고 기각 판단으로 기록됐는가
11. 확인 dialog나 알림 발송 등 다음 scope가 섞이지 않았는가
12. 전이표 중복, 새 의존성, 불필요한 추상화가 없는가

각 지적은 다음 형식으로 작성해라.

- 심각도: blocker / major / minor
- 파일과 코드 위치
- 재현 시나리오
- 문제 원인
- 최소 수정안

추측은 추측이라고 표시하고 스타일 취향만으로 지적하지 마라.
문제가 없다면 확인한 범위와 미검증 범위를 분리해서 보고해라.
```

### AI 출력 요지

- 기존 `stages` 모델에 단일 전이표와 순수 조회·판정 함수를 추가하고, UI select와 MSW PATCH handler가 이를 함께 사용하도록 제안·구현했다.
- 종료 상태에는 form 대신 상태 문구를 표시하고, handler는 저장 함수 호출 전 `409 INVALID_TRANSITION`을 반환하도록 했다.
- 기존 TanStack Query 낙관적 갱신, 대상 엔티티 rollback, 동기 pending guard, 서로 다른 카드 병렬 이동은 변경하지 않았다.
- 문서의 FR-03·API 계약·Undo 기각 판단을 같은 정책으로 갱신하고, 사용자 검증 뒤 읽기 전용 리뷰에서 지적 사항이 없다고 확인했다.

### 리뷰 / 검증

#### 1. 테스트 우선과 구현 검토

- RED: 순수 정책 함수 부재, 금지 PATCH의 200 저장, 서류검토 UI에 허용되지 않은 옵션 노출 때문에 focused 테스트 11개가 실패했다.
- 채택: `ALLOWED_NEXT_STAGES`와 `getAllowedNextStages`/`canTransitionTo`를 `stages.ts`에 두고, UI와 handler가 이 정책을 직접 소비하게 했다.
- 기각: UI와 API에 별도 전이표를 쓰는 방식, 새 상태 저장소·의존성, 확인 dialog·알림 발송·Undo 구현은 범위 밖이므로 추가하지 않았다.

#### 2. 자동 검증

- focused: `npm run test -- src/features/recruitment-board/model/stages.test.ts src/mocks/handlers.test.ts src/App.test.tsx` — 3개 파일, 46개 테스트 통과.
- `npm run lint`: 통과.
- `npm run test`: Vitest 8개 파일, 70개 테스트 통과. 사용자 검증 후 읽기 전용 리뷰에서도 8개 파일, 70개 테스트 통과를 재확인했다.
- `npm run build`: 통과. 기존 500kB 초과 chunk 경고는 유지됐다.
- `git diff --check`: 통과.

#### 3. 수동 검증과 리뷰

- 사용자 확인: 보고한 수동확인 시나리오 모두 확인했다고 응답했다.
- 읽기 전용 리뷰: 단일 정책 공유, 직접 PATCH 차단, 이전·건너뛰기·종료 상태 차단, 오류 코드 구분, 저장 전 409, FR-04·FR-08 회귀, 문서 일치, Undo 기각, 범위 밖 기능·중복·새 의존성 부재를 점검했고 지적 사항은 없었다.
- 직접 브라우저 조작은 이 세션에서 수행하지 않았다.

#### 4. 최종 판단

- 채택: 허용 전이는 낙관적으로 반영되고 성공 응답을 병합하며, 실패 시 이전 applicant 한 건만 복원하는 기존 흐름을 유지했다.
- 제한: 상태 정정·감사 로그·관리자 전용 전이와 실제 알림 발송은 구현하지 않았다.

### 연결 커밋

- 예정 메시지:

  ```text
  feat(stage-transition-policy): 채용 단계의 단방향 전이 강제

  - UI와 mock API가 공유하는 순수 전이 정책 추가
  - 금지 전이를 409 INVALID_TRANSITION으로 저장 전 차단
  - 종료 상태 UI와 전이·회귀 테스트 및 문서 갱신
  ```

- 해시: 최종 동기화 대기

## [stage-change-confirmation] 단계 변경 전 최종 확인

### 목표 / 수용 기준

- 연결 요구사항: FR-03; FR-04, FR-08, FR-11 회귀 보호
- 허용된 단계 이동도 PATCH 전에 native confirmation dialog에서 최종 확인한다.
- 취소·Esc는 Query cache와 localStorage를 변경하지 않고, 확인 뒤에는 기존 optimistic move 흐름을 사용한다.

### 프롬프트 1 — 단계 변경 확인 구현

```text
AGENTS.md와 다음 자료를 지정된 순서로 읽어라.

1. docs/ASSIGNMENT.md
2. docs/PRD.md
3. docs/TECH_SPEC.md
4. docs/IMPLEMENTATION_AND_COMMIT_PLAN.md
5. PROMPTS.md의 현재 stage-change-confirmation 섹션
6. 최근 stage-transition-policy 커밋과 관련 현재 코드

이번 작업 scope는 stage-change-confirmation 하나뿐이다.
연결 요구사항은 FR-03이며, FR-04·FR-08·FR-11의 기존 동작이 깨지지 않아야 한다.

변경 배경:

단계 변경이 향후 지원자 알림 같은 외부 동작으로 연결될 수 있다.
일반 채용담당자의 실수로 잘못된 알림이 발생하는 것을 줄이기 위해,
허용된 단계 전이라도 실제 PATCH 요청 전에 명시적인 최종 확인을 받는다.

확정 동작:

1. 사용자가 카드에서 허용된 목표 단계를 선택한다.
2. 이동 버튼을 실행한다.
3. 이 시점에는 move()를 호출하지 않는다.
4. 지원자명·현재 단계·변경 단계가 표시된 확인 dialog를 연다.
5. 확인을 실행한 경우에만 기존 move(applicantId, targetStage)를 호출한다.
6. 확인 이후 기존 낙관적 업데이트, PATCH, rollback, pending guard 흐름을 그대로 사용한다.
7. 취소 button 또는 Esc로 닫으면 Query cache와 localStorage를 변경하지 않는다.
8. 취소 뒤 포커스를 확인 dialog를 열었던 이동 button으로 복귀시킨다.
9. HIRED와 REJECTED에는 이동 form이 없으므로 확인 dialog 진입점도 없다.

완료 기준:

- 네이티브 <dialog>와 showModal()을 사용한다.
- dialog 제목을 aria-labelledby로 연결한다.
- 지원자 이름, 현재 단계, 변경 단계를 사람이 읽을 수 있는 라벨로 표시한다.
- 확인 button과 취소 button을 제공한다.
- Esc는 취소와 동일하게 처리한다.
- dialog를 열기 전에는 move(), fetch, mutation.mutate를 호출하지 않는다.
- dialog를 열거나 취소하는 것만으로 TanStack Query cache가 변경되지 않는다.
- dialog를 열거나 취소하는 것만으로 localStorage가 변경되지 않는다.
- 확인 직후에만 기존 낙관적 업데이트가 시작된다.
- 확인 후 PATCH 실패 시 기존 엔티티 단위 rollback을 유지한다.
- 확인 후 동일 카드 중복 요청은 기존 synchronous pending guard로 차단한다.
- 서로 다른 지원자의 이동은 기존처럼 병렬 처리할 수 있다.
- 종료 상태에는 이동 form과 확인 dialog 진입점이 없다.
- 새 모달·상태 관리 라이브러리를 추가하지 않는다.

최소 구현 원칙:

- 기존 ApplicantDetailDialog의 native dialog 사용 방식을 참고하되, 상세 dialog와 확인 dialog를 위한 범용 modal abstraction은 만들지 않는다.
- 기존 StageMoveForm과 useMoveApplicantStage를 재사용한다.
- mutation hook 내부에 확인 UI 책임을 넣지 않는다.
- StageMoveForm submit은 확인 요청을 상위에 전달하고, 실제 move() 호출은 확인 handler에서만 수행한다.
- 확인 대기 상태는 필요한 applicantId와 targetStage만 보관한다.
- 기존 stage 전이 정책을 다시 구현하거나 복제하지 않는다.
- 관련 없는 App 구조 분리나 컴포넌트 리팩터링을 하지 않는다.

예상 변경 파일:

- src/App.tsx
  - 확인 대기 상태
  - StageChangeConfirmationDialog
  - 확인 후 move() 호출 흐름
- src/App.module.css
  - 필요한 경우 기존 dialog 스타일을 재사용한 최소 확인 dialog 스타일
- src/App.test.tsx
  - 확인 전·취소·확인·회귀 테스트
- docs/PRD.md
  - FR-03과 단계 이동 성공·실패 흐름에 확인 단계를 추가
- docs/TECH_SPEC.md
  - 확인 dialog 책임과 mutation 실행 전 흐름 명시
- docs/IMPLEMENTATION_AND_COMMIT_PLAN.md
  - stage-change-confirmation scope와 검증 항목 추가
- DECISIONS.md
  - 단계 변경 확인을 채택한 이유와 범위 기록
- README.md
  - 사용자 관점의 단계 변경 확인 동작 반영
- PROMPTS.md는 사용자 검증 gate 통과 전에는 수정하지 않음
- docs/ASSIGNMENT.md는 원문이므로 수정하지 않음

DECISIONS.md에는 다음 결정을 기록한다.

- 모든 허용된 단계 변경은 실제 요청 전에 채용담당자의 확인을 받는다.
- 목적은 향후 지원자 알림 같은 외부 동작과 잘못된 상태 변경의 위험을 줄이는 것이다.
- 확인 dialog는 안전장치이며 실제 알림 발송이나 감사 로그를 구현하지 않는다.
- 취소·Esc는 아무 상태도 변경하지 않는다.
- 확인 후에는 검증된 기존 move() 흐름을 재사용한다.
- window.confirm, 새 dialog 라이브러리, 전역 확인 상태는 사용하지 않는다.
- 관리자 상태 정정, 알림 발송 실패 정책, 감사 로그는 향후 별도 scope다.

이번 작업에서 하지 않을 것:

- 실제 지원자 알림 발송
- 관리자 전용 상태 정정
- 감사 로그
- Undo
- stage 전이 정책 변경
- seed 데이터 변경
- 리디자인·반응형·성능 개선
- 범용 dialog 시스템
- 관련 없는 리팩터링
- 커밋
- 사용자 검증 전 PROMPTS.md 수정이나 staging

편집 전에 먼저 다음을 출력해라.

1. 요구사항 ID
2. 재사용할 현재 코드와 기존 dialog 패턴
3. 생성·수정할 파일과 책임
4. 확인 대기 상태의 최소 데이터 구조
5. submit → dialog → confirm/cancel → move 흐름
6. Query cache와 localStorage 불변을 확인할 시나리오
7. 먼저 실패시킬 테스트
8. 범위를 넘는 제안과 제외 이유

테스트를 먼저 작성해 현재 동작에서 실패하는지 확인한 뒤 최소 구현해라.

필수 자동 검증:

- 이동 button 실행 시 dialog가 열리고 PATCH는 0회
- dialog에 지원자명·현재 단계·변경 단계 표시
- dialog가 열린 동안 카드가 기존 컬럼에 유지
- 취소 button 후 PATCH 0회
- Esc 후 PATCH 0회
- 취소·Esc 후 Query cache 불변
- 취소·Esc 후 localStorage 불변
- 취소 후 원래 이동 button으로 포커스 복귀
- 확인 button 실행 후 PATCH 1회
- 확인 직후 응답 전 목표 컬럼으로 낙관적 이동
- 확인 후 PATCH 실패 시 이전 applicant 한 건만 rollback
- 동일 카드 빠른 확인 중복 시 기존 pending guard 유지
- 서로 다른 카드의 확인된 이동은 병렬 처리 가능
- HIRED와 REJECTED에는 확인 dialog 진입점 없음
- 기존 직접 API 전이 정책 검증 유지
- npm run lint
- npm run test
- npm run build
- git diff --check

자동 검증 후 변경 파일, unstaged diff, 실제 명령 결과, 수용 기준 충족 여부, 알려진 한계와 사용자 수동 검증 시나리오를 보고하고 기다려라.
사용자가 검증 결과를 보고하거나 미검증 범위를 명시적으로 수용하기 전에는 prompt-record, staging, commit을 진행하지 마라.
```

### 프롬프트 2 — 사용자 검증 후 읽기 전용 리뷰

```text
“두 요청이 실제로 동시에 pending”인 상태를 사람이 재현·검증하기 어렵기 때문에 이 항목은 자동 테스트로만 검증 근거를 삼아야 하고 수동 검증 목록에서는 제외. 나머지 수동 검증 모두 검증 완료.

현재 브랜치의 stage-change-confirmation 미커밋 diff를 읽기 전용으로 리뷰해라.
파일은 수정하지 마라.

연결 요구사항은 FR-03이며 FR-04, FR-08, FR-11 회귀도 확인한다.

우선순위:

1. 이동 form submit이 move()를 직접 호출하지 않는가
2. 확인 전 PATCH, mutation, Query cache 변경이 전혀 없는가
3. 취소와 Esc가 Query cache와 localStorage를 변경하지 않는가
4. 확인한 경우에만 기존 move()를 정확히 한 번 호출하는가
5. 확인 직후 기존 낙관적 업데이트가 시작되는가
6. 실패 시 previousApplicant 한 건만 rollback하는 기존 흐름이 유지되는가
7. pendingIdsRef의 동일 카드 synchronous guard가 유지되는가
8. 서로 다른 지원자는 계속 병렬 이동할 수 있는가
9. dialog가 지원자명·현재 단계·목표 단계의 사람이 읽을 수 있는 라벨을 표시하는가
10. aria-labelledby, 확인·취소 이름, Esc, 취소 후 focus restore가 올바른가
11. HIRED와 REJECTED에는 이동 form과 dialog 진입점이 없는가
12. 기존 단방향 전이 정책을 복제하거나 우회하지 않는가
13. 문서와 실제 UI 흐름이 일치하는가
14. 실제 알림 발송·Undo·감사 로그·리디자인이 섞이지 않았는가
15. 범용 modal abstraction, 새 의존성, 전역 상태 같은 과설계가 없는가

각 지적은 다음 형식으로 작성해라.

- 심각도: blocker / major / minor
- 파일과 코드 위치
- 재현 시나리오
- 문제 원인
- 최소 수정안

추측은 추측이라고 표시하고 스타일 취향만으로 지적하지 마라.
문제가 없다면 확인한 범위와 미검증 범위를 분리해서 보고해라.
```

### AI 출력 요지

- `StageMoveForm`의 submit을 확인 요청으로 바꾸고, `App`의 최소 확인 대기 상태는 applicantId와 targetStage만 보관했다.
- 확인 dialog는 기존 native dialog 패턴과 `STAGES` 라벨을 사용하며, 확인 handler만 기존 `move()`를 호출한다.
- mutation hook·전이 정책·mock API는 수정하지 않아 기존 낙관적 업데이트, 한 엔티티 rollback, pending guard와 직접 PATCH 정책 검증을 재사용했다.

### 리뷰 / 검증

#### 1. 테스트 우선과 구현 검토

- RED: `npm run test -- src/App.test.tsx`에서 확인 dialog를 찾지 못해 1개 테스트가 실패했고, 기존 submit이 즉시 pending·낙관적 이동을 시작한 DOM을 확인했다.
- 채택: native `<dialog>`와 `showModal()`을 사용해 submit과 mutation 사이에 확인 경계를 넣었다. 취소 trigger는 ref로만 보관해 확인 대기 state를 applicantId·targetStage로 제한했다.
- 기각: `window.confirm`, 새 dialog/state 라이브러리, 범용 modal abstraction, mutation hook 내부 확인 UI, 전이 정책 복제는 기존 패턴과 범위를 넓히므로 사용하지 않았다.

#### 2. 자동 검증

- focused: 구현 후 `npm run test -- src/App.test.tsx` — 23개 테스트 통과.
- 전체: `npm run lint` 통과, `npm run test` — 8개 파일·72개 테스트 통과, `npm run build` 통과.
- `git diff --check` 통과. build의 500kB 초과 chunk 경고는 기존 경고로 유지됐다.
- 확인 전 PATCH 0회·Query cache/localStorage 불변, 취소·Esc 불변, 취소 후 focus 복귀를 통합 테스트로 검증했다. 확인 후 optimistic update·실패 rollback·동일 카드 guard·다른 카드 병렬 pending 회귀도 기존 통합 테스트 흐름에서 확인했다.

#### 3. 사용자 검증과 읽기 전용 리뷰

- 사용자 확인: 두 요청이 실제로 동시에 pending인 경우는 자동 테스트만 근거로 삼고 수동 목록에서 제외했다. 이를 제외한 보고된 수동 검증 시나리오는 모두 완료됐다.
- 읽기 전용 리뷰: FR-03과 FR-04·FR-08·FR-11 회귀, native dialog 접근성, 종료 상태, 단일 전이 정책, 문서 일치, 범위 밖 기능·새 의존성·전역 상태 부재를 점검했고 지적 사항은 없었다.
- 직접 브라우저 조작은 이 세션에서 수행하지 않았다.

#### 4. 최종 판단

- 채택: 확인 전과 취소 후에는 저장·cache mutation이 없고, 확인 시에만 검증된 기존 move 흐름이 시작된다.
- 제한: 실제 지원자 알림, 관리자 상태 정정, 감사 로그, Undo와 스크린리더별 native dialog 안내 세부 동작은 이 scope에서 구현·검증하지 않았다.

### 연결 커밋

- 예정 메시지:

  ```text
  feat(stage-change-confirmation): 단계 변경 전 최종 확인 추가

  - native dialog에서 지원자와 단계 변경을 확인한 뒤에만 PATCH 실행
  - 취소·Esc의 상태 불변과 focus 복귀를 검증
  - 기존 optimistic update·rollback·pending guard 회귀 보존
  ```

- 해시: 최종 동기화 대기

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

## [seed-data-variety] 기본 seed의 한글·영문 이름 다양성

### 목표 / 수용 기준

- 연결 요구사항: FR-05 영문 대소문자 무시 검색의 수동 검증 보완
- 기본 240건 seed에 결정적인 한글·영문 이름을 포함한다.
- 유효한 기존 localStorage 배열은 유지하고, 저장 키 부재 또는 손상 시에만 혼합 seed를 생성·저장한다.
- 기존 ID, role, appliedAt, stage, email, phone 생성 규칙과 검색 selector/UI는 변경하지 않는다.

### 프롬프트 1 — 최초 지시

```text
AGENTS.md와 다음 자료를 지정된 순서로 읽어라.

1. docs/ASSIGNMENT.md
2. docs/PRD.md
3. docs/TECH\_SPEC.md
4. docs/IMPLEMENTATION\_AND\_COMMIT\_PLAN.md
5. PROMPTS.md의 현재 seed-data-variety 섹션
6. 관련 최근 커밋과 현재 코드

이번 작업 scope는 seed-data-variety 하나뿐이다.
연결 요구사항은 FR-05의 영문 대소문자 무시 검색을 실제 seed 데이터로 시연·검증할 수 있게 보완하는 것이다.

변경 배경:

현재 createSeedApplicants()는 모든 이름을 `지원자 001` 형식으로 생성한다.
영문 대소문자 무시 검색은 자동 테스트 fixture로 검증됐지만,
실제 브라우저의 기본 seed 데이터에서는 수동으로 확인할 수 없다.

완료 기준:

- 기본 240건 seed에 결정적인 한글·영문 지원자 이름이 모두 포함된다.
- 같은 size를 전달하면 항상 같은 Applicant 배열을 생성한다.
- 기존 ID, 직무, 지원일, stage, 이메일, 전화번호 생성 규칙은 불필요하게 변경하지 않는다.
- 영문 이름은 실제 화면에서 소문자·대문자 검색을 비교할 수 있어야 한다.
- 기존 유효한 localStorage 데이터는 loadApplicants() 호출 시 그대로 유지한다.
- localStorage가 비어 있을 때만 새 혼합 seed가 생성·저장된다.
- 기존 저장 키를 변경하지 않는다.
- migration, seed versioning, 자동 reset, 데이터 초기화 UI를 추가하지 않는다.
- 손상된 저장 데이터에 대한 기존 복구 동작은 유지한다.
- 새 라이브러리를 추가하지 않는다.

최소 구현 원칙:

- src/mocks/seedApplicants.ts의 기존 index 기반 생성 방식을 유지한다.
- 작은 고정 이름 목록을 index로 순환해 한글·영문 이름을 결정적으로 배정한다.
- 이름 고유성을 위한 별도 ID 체계나 사람 이름 생성 라이브러리를 만들지 않는다.
- 지원자 ID는 기존처럼 유일하게 유지하되 이름 중복은 허용한다.
- 검색 selector와 UI는 이미 요구사항을 만족하므로 수정하지 않는다.
- mockDb 구현은 보존 테스트가 실패하지 않는 한 수정하지 않는다.

예상 변경 파일:

- src/mocks/seedApplicants.ts
  - 결정적인 한글·영문 이름 목록과 배정
- src/mocks/seedApplicants.test.ts
  - 혼합 이름, 결정성, size와 기존 핵심 필드 규칙 검증
- src/mocks/mockDb.test.ts
  - 기존 유효 localStorage 데이터가 새 seed로 교체되지 않는 회귀 테스트
- docs/TECH\_SPEC.md
  - 혼합 seed와 기존 저장 데이터 유지 규칙 명시
- docs/IMPLEMENTATION\_AND\_COMMIT\_PLAN.md
  - seed-data-variety scope와 검증 항목 추가
- DECISIONS.md
  - migration·저장 키 변경 없이 신규 저장소에만 적용하는 결정 기록
- PROMPTS.md는 사용자 검증 gate 통과 전에는 수정하지 않는다.

수정하지 않을 파일:

- docs/ASSIGNMENT.md
- 기존 search-filter 코드와 PROMPTS.md의 이전 feature section
- localStorage 저장 키
- App UI와 검색 selector
- stage 전이·확인 dialog 코드

이번 작업에서 하지 않을 것:

- 기존 localStorage 자동 초기화
- migration 또는 seed version bump
- 데이터 초기화 button
- 검색 로직 변경
- 1,000건 성능·가상화
- 시각 리디자인·반응형
- 실제 개인정보나 외부 데이터 사용
- 관련 없는 리팩터링
- 커밋
- 사용자 검증 전 prompt-record 또는 staging

편집 전에 먼저 다음을 출력해라.

1. 연결 요구사항
2. 현재 코드에서 재사용할 부분
3. 생성·수정할 파일과 책임
4. 이름 배정 알고리즘
5. 빈 저장소와 기존 저장소의 데이터 흐름
6. 결정성·혼합 이름·기존 데이터 보존 검증 시나리오
7. 먼저 실패시킬 테스트
8. 범위를 넘는 제안과 제외 이유

테스트를 먼저 작성해 현재 seed에서 실패하는지 확인한 뒤 최소 구현해라.

필수 자동 검증:

- 기본 seed에 한글 이름이 존재함
- 기본 seed에 영문 이름이 존재함
- 같은 size의 두 결과가 완전히 같음
- 요청한 size와 ID 유일성이 유지됨
- 기존 stage·role 배정 규칙이 유지됨
- 유효한 기존 localStorage 데이터가 변경되지 않음
- 빈 localStorage에서는 새 혼합 seed가 저장됨
- 손상된 저장 데이터의 기존 복구 동작 유지
- 기존 검색·필터 테스트 통과
- npm run lint
- npm run test
- npm run build
- git diff --check

자동 검증 후 변경 파일, unstaged diff, 실제 명령 결과,
수용 기준 충족 여부, 알려진 한계와 사용자 수동 검증 시나리오를 보고하고 기다려라.

사용자가 검증 결과를 보고하거나 미검증 범위를 명시적으로 수용하기 전에는
prompt-record, staging, commit을 진행하지 마라.
```

### 프롬프트 2 — 사용자 검증 후 읽기 전용 리뷰

```text
확인 및 사용자 검증 완료.

현재 브랜치의 seed-data-variety 미커밋 diff를 읽기 전용으로 리뷰해라. 파일은 수정하지 마라.

연결 요구사항은 FR-05의 영문 대소문자 검색 시연 보완이다.

우선순위:

1. 기본 seed에 한글·영문 이름이 실제로 모두 포함되는가
2. 같은 size에서 결과가 결정적인가
3. 기존 ID, role, stage 등 무관한 생성 규칙을 불필요하게 바꾸지 않았는가
4. 기존 유효 localStorage가 새 seed로 덮어써지지 않는가
5. STORAGE\_KEY 변경이나 자동 migration이 추가되지 않았는가
6. 빈 저장소에서만 새 seed가 저장되는가
7. 손상 저장소의 기존 복구 동작이 유지되는가
8. 영문 이름으로 기존 대소문자 무시 검색을 수동 검증할 수 있는가
9. 검색 selector나 UI를 불필요하게 수정하지 않았는가
10. 이름 생성 라이브러리, 고유 이름 생성기, seed versioning 같은 과설계가 없는가
11. 문서와 실제 구현이 일치하는가
12. 다른 feature scope의 코드나 기록이 섞이지 않았는가

각 지적은 다음 형식으로 작성해라.

- 심각도: blocker / major / minor
- 파일과 코드 위치
- 재현 시나리오
- 문제 원인
- 최소 수정안

추측은 추측이라고 표시하고 스타일 취향만으로 지적하지 마라.
문제가 없다면 확인한 범위와 미검증 범위를 분리해 보고해라.
```

### AI 출력 요지

- 기존 index 기반 `createSeedApplicants()`에 고정 한글·영문 이름 목록을 추가하고 index modulo로 순환 배정했다.
- 이름 외 ID, role, appliedAt, stage, email, phone 생성 규칙은 보존했다.
- 유효 localStorage 보존, 빈 저장소 mixed seed 저장, 손상 저장소 복구를 회귀 테스트로 확인했다.
- 반복 이름으로 인해 기존 영속성 통합 테스트가 placeholder 이름을 식별자로 사용하던 부분을, 저장된 applicant ID와 컬럼 count를 검증하도록 보정했다.
- TECH_SPEC, 구현·커밋 계획, DECISIONS에 신규·손상 저장소에만 적용하는 범위를 기록했다.

### 리뷰 / 검증

#### 1. 테스트 우선과 구현 검토

- RED: `npm run test -- src/mocks/seedApplicants.test.ts src/mocks/mockDb.test.ts`에서 기본 seed의 `김민지`와 `Alex Kim` 부재로 2개 테스트가 실패했다.
- 채택: 이름 목록 4개를 index modulo로만 순환해 결정성을 유지했다. 별도 ID·사람 이름 생성기·migration·seed versioning은 추가하지 않았다.
- 회귀 수정: 전체 테스트에서 기존 `지원자 001` 이름을 form 식별자로 사용하던 영속성 테스트가 실패했다. 반복 이름을 고유화하지 않고, 이동된 `applicant-001`의 저장 stage와 면접 컬럼 count를 확인하도록 테스트만 바꿨다.

#### 2. 자동 검증

- focused: `npm run test -- src/mocks/seedApplicants.test.ts src/mocks/mockDb.test.ts` — 15개 테스트 통과.
- 검색 회귀: `npm run test -- src/features/recruitment-board/model/applicantSelectors.test.ts` — 3개 테스트 통과.
- 전체: `npm run lint` 통과, `npm run test` — 8개 파일·76개 테스트 통과, `npm run build` 통과.
- `git diff --check` 통과. build의 500kB 초과 chunk 경고는 기존 경고로 유지됐다.

#### 3. 사용자 검증과 읽기 전용 리뷰

- 사용자 확인: 사용자가 seed-data-variety 수동 검증 완료를 보고했다. 구체적인 브라우저 조작 결과는 별도로 제공되지 않았다.
- 읽기 전용 리뷰: 혼합 이름, 결정성, 기존 저장 데이터 보존, storage key·migration·자동 reset 부재, 손상 저장소 복구, 기존 검색 selector/UI 무변경, 문서 일치와 scope 혼입 여부를 점검했고 지적 사항은 없었다.
- 리뷰 중 관련 테스트 18개, lint, `git diff --check`를 다시 실행해 통과했다. 전체 테스트와 build는 이 읽기 전용 리뷰 단계에서는 재실행하지 않았다.

#### 4. 최종 판단

- 채택: 새 브라우저 저장소에서는 한글·영문 이름을 기본 seed에서 확인하고 `alex`·`ALEX` 검색을 비교할 수 있다.
- 제한: 기존 유효 localStorage 데이터는 의도적으로 자동 갱신하지 않으므로, 이미 저장된 기존 seed에서는 영문 이름이 추가되지 않는다. 사용자가 저장 키를 제거한 새 저장소에서만 이 수동 시연이 가능하다.

### 연결 커밋

- 예정 메시지:

  ```text
  feat(seed-data-variety): 한글·영문 혼합 시드 데이터 제공

  - 기본 seed에서 한글·영문 이름을 결정적으로 생성
  - 기존 유효 localStorage를 유지하고 빈 저장소에만 새 seed 적용
  - 실제 seed 기반 영문 대소문자 검색 검증 지원
  ```

- 해시: 최종 동기화 대기
