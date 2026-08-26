# 채용 파이프라인 보드 구현·커밋 계획

## 0. 운영 원칙

- 한 기능을 구현하고 검증하고 기록하고 커밋한 뒤 다음 기능으로 넘어간다.
- Undo와 가상화는 6~10시간 활성 구현 계획에서 제외하고 후속 후보로만 남긴다.
- 각 커밋에서 코드와 해당 기능의 `PROMPTS.md` 섹션을 함께 포함한다.
- 커밋 전 `git diff`, 관련 테스트, 전체 lint/test/build를 확인한다.
- 커밋 후 squash, amend 남용, force-push를 하지 않는다.
- 실수나 수정 커밋도 의미가 있으면 남기고, 무엇을 왜 고쳤는지 설명한다.

### 요구사항 추적성

| 과제 원문 | PRD | TECH_SPEC | 구현 커밋 | 관련 결정 | README |
|---|---|---|---|---|---|
| §2.1 보드·컬럼 | FR-01 | §10 | `board-layout` | D-001 | 구현 범위 > Must |
| §2.1 지원자 카드 | FR-02 | §3, §10 | `card-list` | D-001 | 구현 범위 > Must |
| §2.2 단계 이동·영속화 | FR-03 | §4, §5, §8 | `stage-move` | D-002, D-004 | 구현 범위 > Must |
| §2.3 낙관적 업데이트·롤백 | FR-04 | §8 | `optimistic-update` | D-003, D-005, D-007 | 구현 범위 > Must |
| §2.4 이름 검색·직무 필터 | FR-05 | §9 | `search-filter` | D-006 | 구현 범위 > Must |
| §2.5 상세 보기 | FR-06 | §10 | `detail-panel` | D-002 | 구현 범위 > Must |
| §2.6 로딩·오류·빈 상태 | FR-07 | §7, §11 | `ui-states` | D-006 | 구현 범위 > Must |
| §3 경쟁 상태 | FR-08 | §8 | `optimistic-update` | D-005, D-007 | 구현 범위 > Should |
| §3 Undo | FR-09 | 활성 범위 제외 | 없음 | D-006 | 제외 범위 |
| §3 1,000건 성능 | FR-10 | 활성 범위 제외 | 없음 | D-006 | 제외 범위 |
| §3 웹 접근성 | FR-11 | §10, §11 | `board-layout`, `card-list`, `optimistic-update`, `search-filter`, `detail-panel`, `ui-states`; 결함 수정 시 `a11y-keyboard` | D-002 | 구현 범위 > Should |
| §4 mock API 자체 구현·200~800ms·약 15% 실패 | 제품 가정 §6 | §4, §5 | `mock-api` | D-004 | mock API |
| §2.2 유효하지 않은 이동 저장 금지 | FR-03 | §4, §5 | `mock-api` | D-008 | mock API |
| 선택 기술: CSS Modules | 비기능 요구사항 §11 | §0 | `project-setup` | D-009 | 기술 구성 |
| §5~7 기능별 커밋·기록·제출 | 제출·평가 목표 §3.2 | 완료 정의 §15 | 모든 기능, `submission-review` | 범위 우선순위 | 실행·검증·구현 범위 |

## 1. 기능·커밋 순서

### Commit 01 — 요구사항과 설계 기준

```text
docs(00-planning-review): 과제 요구사항과 구현 기준 검토
```

범위:

- 연결 근거: 과제 §5~7, PRD §3.2
- `docs/ASSIGNMENT.md`
- `docs/PRD.md`
- `docs/TECH_SPEC.md`
- `docs/IMPLEMENTATION_AND_COMMIT_PLAN.md`
- `PROMPTS.md` 템플릿
- `DECISIONS.md` 초기 결정
- `AGENTS.md`

검증:

- Must 요구사항마다 PRD 수용 기준이 있는지 확인
- 모든 Must가 구현 계획의 커밋에 연결되는지 확인
- 단계 코드·라벨·이동 가정이 문서 사이에서 일치하는지 확인

AI 기록:

- `[00-planning-review]`

### Commit 02 — 프로젝트 초기화

```text
chore(project-setup): React TypeScript 프로젝트와 품질 도구 초기화
```

범위:

- 연결 근거: D-001 기술 기반
- Vite React TypeScript scaffold
- 기본 불필요 예제 제거
- Query provider
- ESLint
- Vitest + Testing Library 기본 설정
- 기본 app shell
- non-empty 디렉터리와 초기 `git status --short` 확인
- 기존 문서를 삭제하지 않고, 필요하면 임시 하위 디렉터리에 Vite scaffold 후 프로젝트 파일만 이동

검증:

```bash
npm run lint
npm run test
npm run build
```

수동 확인:

- 별도 터미널에서 `npm run dev` 실행
- 30초 안에 로컬 URL 준비 메시지를 확인하고 페이지를 연 뒤 `Ctrl-C`로 종료
- 30초 안에 준비되지 않으면 프로세스를 종료하고 project-setup 검증 실패로 기록
- 빈 app shell이 오류 없이 렌더링됨
- 콘솔 오류 없음
- 작업 전후 `git status --short`와 diff에서 기존 문서가 보존됐는지 확인

AI 기록:

- `[project-setup]`

### Commit 03 — mock API

```text
feat(mock-api): 지원자 조회·단계 저장과 지연·실패·영속화 구현
```

범위:

- 연결 근거: 과제 §4 mock API 기술 제약
- Applicant 타입
- stage 상수
- seed generator
- localStorage mock DB
- MSW browser/server 설정
- GET/PATCH handler
- 200~800ms 지연
- 기본 15% 실패

검증:

- 결정적 seed가 같은 크기에서 같은 데이터를 생성하는 테스트
- GET 성공 응답 240건
- GET 강제 실패 503
- PATCH 성공 시 localStorage 변경
- PATCH 실패 시 localStorage 불변
- 존재하지 않는 ID, 빈·잘못된 JSON·객체가 아닌 body, 유효하지 않은 타입·값의 stage가 저장 없이 400/404로 거부됨
- 지연 helper가 200~800ms 범위를 사용하고 기본 실패율이 `0.15`인지 확인
- 서로 다른 두 지원자의 PATCH가 모두 성공한 뒤 재조회해 두 변경이 함께 유지되는지 확인

AI 기록:

- `[mock-api]`

### Commit 04 — 보드 레이아웃

```text
feat(board-layout): 채용 단계 컬럼과 보드 기본 레이아웃 구현
```

범위:

- 연결 요구사항: FR-01
- 다섯 단계 컬럼
- 제목·카운트 자리
- 보드 가로 스크롤
- 페이지 헤더

검증:

- 5개 컬럼 순서 확인
- 작은 viewport에서 페이지 전체가 아니라 보드가 가로 스크롤되는지 확인
- 각 컬럼 heading과 section 연결 확인

AI 기록:

- `[board-layout]`

### Commit 05 — 카드 목록

```text
feat(card-list): 지원자 조회와 단계별 카드 표시 구현
```

범위:

- 연결 요구사항: FR-02
- `useApplicantsQuery`
- 단계별 그룹화
- 카드 이름·직무·지원일·현재 단계
- 컬럼별 카운트

검증:

- 각 지원자가 자신의 stage 컬럼에 한 번만 나타남
- 카드 필수 정보 표시
- 총 카드 수가 응답 배열 길이와 일치
- 날짜 포맷 확인

AI 기록:

- `[card-list]`

### Commit 06 — 기본 단계 이동과 저장

```text
feat(stage-move): 명시적 단계 변경 액션과 mock API 저장 구현
```

범위:

- 연결 요구사항: FR-03
- 단계 선택 + 이동 버튼
- 현재 단계 제외 옵션
- PATCH API 연결
- 이 커밋에서는 API 성공 뒤 화면 반영이어도 됨
- 성공/실패 기본 피드백

검증:

- 모든 다른 단계로 이동 가능
- 성공 뒤 새로고침 유지
- 현재 단계 제출 불가
- 실패 시 저장소 불변

AI 기록:

- `[stage-move]`

### Commit 07 — 낙관적 업데이트와 롤백

```text
feat(optimistic-update): 즉시 단계 반영과 엔티티 단위 실패 롤백 구현
```

범위:

- 연결 요구사항: FR-04, FR-08
- 캐시 순수 함수
- `onMutate` 즉시 이동
- previous applicant context
- `onError` 한 엔티티 복원
- `onSuccess` 서버 응답 병합
- pending IDs ref/set과 동일 ID synchronous guard
- 서로 다른 ID 병렬 이동 허용
- 오류 alert
- 낙관적 성공·실패·동시 이동·중복 차단 테스트를 같은 커밋에 포함

검증:

- 응답 대기 중 이미 목표 컬럼에 나타남
- 강제 실패 후 이전 컬럼 복귀
- A 실패/B 성공 시 A만 복원됨
- 같은 카드 더블 실행 시 PATCH 1회
- 다른 카드 두 건은 함께 pending 가능
- 전체 snapshot rollback을 사용하지 않음

AI 기록:

- `[optimistic-update]`

### Commit 08 — 검색·직무 필터

```text
feat(search-filter): 이름 검색과 데이터 기반 직무 필터 구현
```

범위:

- 연결 요구사항: FR-05
- 이름 input
- 직무 select
- 현재 데이터에서 직무 옵션 생성
- 초기화 button
- 결과 수
- filter/group 순수 함수 테스트를 같은 커밋에 포함

검증:

- 부분 검색
- 공백·대소문자 처리
- 이름 + 직무 AND
- 데이터에 존재하는 직무만 옵션으로 표시
- 초기화
- 240건 입력 체감

AI 기록:

- `[search-filter]`

### Commit 09 — 상세 패널

```text
feat(detail-panel): 지원자 상세 다이얼로그 구현
```

범위:

- 연결 요구사항: FR-06
- 카드 본문 상세 버튼
- 우측 sheet 스타일 `<dialog>`
- 상세 필드
- 닫기·Esc·focus restore
- 상세 열기·닫기 키보드 테스트를 같은 커밋에 포함

검증:

- 클릭/Enter로 열림
- 모든 상세 필드 표시
- Esc/닫기 동작
- 닫은 뒤 trigger focus 복귀
- 검색·필터·보드 스크롤 맥락 유지
- 이동 form과 상세 버튼이 중첩되지 않음

AI 기록:

- `[detail-panel]`

### Commit 10 — 로딩·오류·빈 상태

```text
feat(ui-states): 로딩·조회 오류·전체 및 필터 빈 상태 구현
```

범위:

- 연결 요구사항: FR-07
- 접근 가능한 로딩 문구와 최소 placeholder
- GET 오류 + retry
- 전체 데이터 없음
- 필터 결과 없음 + 초기화
- 컬럼 빈 상태

검증:

- 각 상태를 MSW override 또는 seed 제어로 재현
- 오류와 빈 상태 문구가 구분됨
- retry 성공 시 보드 복구

AI 기록:

- `[ui-states]`

### Commit 11 — 키보드·접근성 감사 — 수정이 있을 때만

```text
fix(a11y-keyboard): 키보드 이동과 동적 상태 안내 보완
```

범위:

- 연결 요구사항: FR-11
- 기본 semantic HTML, label, 키보드 동작은 각 기능 커밋에서 함께 구현한다.
- Must 완료 뒤 전체 흐름을 감사하고, 실제 발견된 접근성 결함만 이 커밋에서 수정한다.
- 결함이 없으면 빈 커밋을 만들지 않는다.

검증:

- 마우스 없이 검색, 필터, 상세, 단계 이동, 오류 재시도 가능
- 포커스 표시가 보임
- 중첩 인터랙티브 요소 없음

AI 기록:

- 실제 수정 커밋이 생길 때만 `[a11y-keyboard]`를 작성한다.
- 수정할 결함이 없으면 감사 결과를 `[submission-review]`에 기록한다.

여기까지를 Must + 핵심 가점 완료선으로 본다.

### Commit 12 — 제출 문서 정리

```text
docs(submission-review): 실행·검증 방법과 설계 결정 최종 정리
```

범위:

- 연결 근거: 과제 §6~7 제출물·기록
- README 설치·실행 1~2줄
- 기술 선택과 mock 방식
- 테스트 명령
- 실패율·지연
- 배포 링크
- DECISIONS 완료/미완료 범위 정리

검증:

- 새 clone 기준 실행 명령 확인
- 공개 repo에서 비밀값 없음
- `git log --oneline` 기능 순서 확인
- `git status` clean
- 링크 확인

AI 기록:

- `[submission-review]`

## 2. 기능별 작업 루프

각 기능마다 아래 순서를 반복한다.

1. 현재 기능의 PRD 수용 기준과 TECH_SPEC 인터페이스를 읽는다.
2. Codex에 이번 기능만 구현하도록 프롬프트한다.
3. Codex가 제안한 변경 파일과 접근을 먼저 검토한다.
4. 핵심 동작이면 실패하는 테스트 또는 재현 시나리오를 먼저 만든다.
5. 구현 후 diff를 정독한다.
6. 관련 테스트를 실행한다.
7. 브라우저에서 성공·실패·경계 조건을 직접 재현한다.
8. 요구 누락, 잘못된 가정, 불필요한 의존성, 이해하지 못한 코드를 확인한다.
9. 수정이 필요하면 후속 프롬프트 또는 직접 수정한다.
10. 별도 요청 없이 `prompt-record`로 실제 검증 결과를 현재 scope의 `PROMPTS.md` 섹션에 작성한다. 이전 scope와 해시는 수정하지 않는다.
11. 관련 파일만 stage한다.
12. staged diff를 다시 확인한다.
13. 기능 코드·관련 테스트·기록을 한 커밋으로 남긴다.

`[submission-review]`에서는 이전 기능 섹션 중 `최종 동기화 대기`인 해시를 예정 제목과 exact scope가 모두 일치하는 단일 커밋과 대조해 한 번에 동기화한다. 누락되거나 여러 커밋이 일치하면 추측하지 않고 중단한다.

## 3. 커밋 전 체크리스트

```bash
git status
git diff
git diff --stat
npm run lint
npm run test
npm run build
git add <현재 기능 파일들> PROMPTS.md DECISIONS.md
git diff --cached
git commit
```

확인 질문:

- 이 커밋을 한 문장으로 설명할 수 있는가?
- 다른 기능 코드가 섞여 있지 않은가?
- AI가 추가한 미사용 코드·주석·의존성이 없는가?
- 프롬프트와 리뷰가 실제 이번 커밋을 설명하는가?
- 리뷰에는 재현 방법과 결과가 있는가?
- 실패 또는 포기한 판단도 숨기지 않았는가?

## 4. 범위 중단 기준

다음 중 하나라도 발생하면 Should 구현을 중단하고 제출 품질을 정리한다.

- Must 수동 검증이 하나라도 불안정함
- 낙관적 업데이트 실패 롤백 테스트가 없음
- lint/test/build 중 하나가 실패함
- PROMPTS 기록이 실제 작업보다 뒤처짐
- 범위 밖 Should 작업이 Must 검증 시간을 침범함
- 제출 README와 실행 절차가 검증되지 않음

미완료 기능은 `DECISIONS.md`의 `남긴 범위`에 아래 형식으로 기록한다.

```md
### 남긴 기능: <scope>

- 시도한 범위:
- 중단한 이유:
- 현재 코드에 미완성 흔적을 남겼는지: 아니오
- 이어서 구현한다면 첫 단계:
- Must 결과물에 미치는 영향: 없음
```
