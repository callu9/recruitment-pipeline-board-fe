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

- 예정 메시지: `chore(prompt-workflow): 세션별 프롬프트 기록 흐름 개선`
- 상태: 미커밋
- AI 초안 수정 요약: 최신 로그 추측을 제거하고 hook이 전달한 세션 ID만 사용하도록 제한했다.

## 기능 기록 템플릿

아래 블록을 기능마다 복사한다. 제출 전 빈 템플릿은 제거한다.

```md
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

- 메시지: `type(feature-scope): 요약`
- AI 초안 수정 요약: 한 줄
```

## 좋은 리뷰 예시

```md
### 리뷰 / 검증

- AI 초안은 `onError`에서 전체 query snapshot을 복원했다. 서로 다른 카드 A/B 이동을 동시에 실행한 뒤 A만 실패시키는 테스트를 작성하자 B의 성공 상태도 사라졌다.
- 원인은 A 요청이 시작될 때의 오래된 전체 배열로 캐시를 덮어쓴 것이었다.
- 전체 snapshot rollback을 기각하고, `previousApplicant` 한 건만 context에 저장해 `replaceApplicant`로 복구하도록 수정했다.
- PATCH를 600ms 지연한 테스트에서 응답 전 목표 컬럼 이동을 확인했고, 503 응답 후 A만 원래 컬럼으로 돌아가며 B는 목표 컬럼에 남는 것을 확인했다.
- `npm run lint`, `npm run test`, `npm run build` 모두 통과했다.
```

## 피해야 할 리뷰 예시

```md
- AI가 잘 만들어 줘서 사용했다.
- 테스트해 보니 잘 된다.
- 코드를 검토했다.
```

위 문장은 무엇을 어떻게 검증했는지 재현할 수 없으므로 제출용 기록으로 부족하다.
